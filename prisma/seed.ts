// Seed project TestTrace Self-Test: idempotent, mã cố định cho E2E tham chiếu (nguồn: Q6 Slice 6).
// Chạy: pnpm db:seed (không ghi đè dữ liệu có sẵn).
import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'node:fs';
import { hashPassword } from '@testtrace/domain';

function loadEnv(): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const path of ['.env.example', '.env']) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) vars[m[1]] = m[2];
    }
  }
  return { ...vars, ...process.env };
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  const user = env.DATABASE_USERNAME ?? 'postgres';
  const password = encodeURIComponent(env.DATABASE_PASSWORD ?? '');
  const host = env.DATABASE_HOST ?? 'localhost';
  const port = env.DATABASE_PORT ?? '5432';
  const name = env.DATABASE_NAME ?? 'testtrace_dev';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const user =
    (await prisma.user.findUnique({ where: { email: 'selftest@example.com' } })) ??
    (await prisma.user.create({
      data: {
        email: 'selftest@example.com',
        passwordHash: await hashPassword('selftest-123'),
        name: 'Self Test Owner',
      },
    }));
  const project =
    (await prisma.project.findFirst({ where: { name: 'TestTrace Self-Test' } })) ??
    (await prisma.project.create({ data: { name: 'TestTrace Self-Test' } }));
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: user.id } },
    create: { projectId: project.id, userId: user.id, role: 'OWNER' },
    update: {},
  });

  const seedRequirements = [
    { code: 'REQ-001', title: 'Đăng nhập local', risk: { impact: 5, likelihood: 4 } },
    { code: 'REQ-002', title: 'RTM sống', risk: null },
    { code: 'REQ-003', title: 'CFG Python', risk: null },
  ];
  for (const seed of seedRequirements) {
    let requirement = await prisma.requirement.findUnique({
      where: { projectId_code: { projectId: project.id, code: seed.code } },
    });
    if (!requirement) {
      requirement = await prisma.requirement.create({
        data: { projectId: project.id, code: seed.code, title: seed.title, status: 'APPROVED' },
      });
    }
    if (seed.risk) {
      await prisma.risk.upsert({
        where: { requirementId: requirement.id },
        create: { requirementId: requirement.id, ...seed.risk },
        update: {},
      });
    }
  }

  const suite =
    (await prisma.testSuite.findFirst({ where: { projectId: project.id, name: 'Smoke' } })) ??
    (await prisma.testSuite.create({ data: { projectId: project.id, name: 'Smoke' } }));
  const existingCase = await prisma.testCase.findUnique({
    where: { projectId_code: { projectId: project.id, code: 'TC-001' } },
  });
  const testCase =
    existingCase ??
    (await prisma.testCase.create({
      data: {
        projectId: project.id,
        suiteId: suite.id,
        code: 'TC-001',
        title: 'Đăng nhập đúng',
        expectedResult: 'Vào được dashboard',
        status: 'READY',
      },
    }));
  const req1 = await prisma.requirement.findUniqueOrThrow({
    where: { projectId_code: { projectId: project.id, code: 'REQ-001' } },
  });
  await prisma.requirementTestCase.upsert({
    where: { requirementId_testCaseId: { requirementId: req1.id, testCaseId: testCase.id } },
    create: { requirementId: req1.id, testCaseId: testCase.id },
    update: {},
  });

  const release =
    (await prisma.release.findFirst({ where: { projectId: project.id, name: 'RC-1' } })) ??
    (await prisma.release.create({ data: { projectId: project.id, name: 'RC-1' } }));
  await prisma.build.upsert({
    where: { releaseId_number: { releaseId: release.id, number: '1' } },
    create: { releaseId: release.id, number: '1' },
    update: {},
  });
  await prisma.environment.upsert({
    where: { projectId_name: { projectId: project.id, name: 'Test' } },
    create: { projectId: project.id, name: 'Test' },
    update: {},
  });

  const gate =
    (await prisma.qualityGate.findFirst({
      where: { projectId: project.id, name: 'Release gate' },
    })) ??
    (await prisma.qualityGate.create({
      data: { projectId: project.id, name: 'Release gate', createdBy: user.id },
    }));
  const latest = await prisma.gateVersion.findFirst({
    where: { gateId: gate.id },
    orderBy: { version: 'desc' },
  });
  if (!latest) {
    await prisma.gateVersion.create({
      data: {
        gateId: gate.id,
        version: 1,
        rules: { open_critical_defects: 0, pass_rate_min: 80 },
      },
    });
  }
  console.log('seed ok: TestTrace Self-Test');
}

function run(): void {
  main()
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => {
      void prisma.$disconnect();
    });
}

run();
