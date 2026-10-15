// Integration test chống truy cập chéo projectId + unique member (nguồn: plan M01 nghiệm thu + DB-01).
// Chạy trên TEST database: pnpm db:migrate:test trước, rồi pnpm --filter @testtrace/db test.
// Không dùng dữ liệu cố định để chạy lặp an toàn; dọn dẹp sau mỗi test.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';
import { buildTestDatabaseUrl } from './database-url.js';

// Đọc .env trực tiếp để test không phụ thuộc loader của runner. Không in secret.
function loadEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

const testUrl = buildTestDatabaseUrl({
  ...loadEnvFile('../../.env.example'),
  ...loadEnvFile('../../.env'),
  ...process.env,
});
const prisma = new PrismaClient({ datasourceUrl: testUrl });

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

beforeAll(async () => {
  await prisma.$connect();
});

afterAll(async () => {
  await prisma.project.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.user.deleteMany({ where: { email: { contains: suffix } } });
  await prisma.$disconnect();
});

describe('project isolation', () => {
  it('hai project không đọc chéo member', async () => {
    const userA = await prisma.user.create({
      data: { email: `a-${suffix}@example.com`, passwordHash: 'x', name: 'A' },
    });
    const projectA = await prisma.project.create({ data: { name: `PA-${suffix}` } });
    const projectB = await prisma.project.create({ data: { name: `PB-${suffix}` } });
    await prisma.projectMember.create({
      data: { projectId: projectA.id, userId: userA.id, role: 'OWNER' },
    });

    const leak = await prisma.projectMember.findMany({
      where: { projectId: projectB.id, userId: userA.id },
    });
    expect(leak).toEqual([]);
  });

  it('một user không làm member trùng trong cùng project (P2002)', async () => {
    const user = await prisma.user.create({
      data: { email: `dup-${suffix}@example.com`, passwordHash: 'x' },
    });
    const project = await prisma.project.create({ data: { name: `PDUP-${suffix}` } });
    await prisma.projectMember.create({
      data: { projectId: project.id, userId: user.id, role: 'TESTER' },
    });
    await expect(
      prisma.projectMember.create({
        data: { projectId: project.id, userId: user.id, role: 'VIEWER' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
