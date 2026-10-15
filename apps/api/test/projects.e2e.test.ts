// E2E RBAC: ma trận 4 role, bảo vệ Owner cuối, chống chéo project (nguồn: M01 nghiệm thu + AUTH-02).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const emails = {
  owner: `rbac-owner-${suffix}@example.com`,
  manager: `rbac-manager-${suffix}@example.com`,
  tester: `rbac-tester-${suffix}@example.com`,
  viewer: `rbac-viewer-${suffix}@example.com`,
  outsider: `rbac-outsider-${suffix}@example.com`,
};

let app: INestApplication;
const tokens: Record<string, string> = {};
const userIds: Record<string, string> = {};
let projectId = '';

async function loginAs(email: string): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  return res.body.accessToken as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  for (const [role, email] of Object.entries(emails)) {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);
    tokens[role] = await loginAs(email);
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set(auth(tokens[role]))
      .expect(200);
    userIds[role] = me.body.id as string;
  }

  const created = await request(app.getHttpServer())
    .post('/api/projects')
    .set(auth(tokens.owner))
    .send({ name: `RBAC-${suffix}` })
    .expect(201);
  projectId = created.body.id as string;

  for (const [role, r] of [
    ['manager', 'MANAGER'],
    ['tester', 'TESTER'],
    ['viewer', 'VIEWER'],
  ] as const) {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set(auth(tokens.owner))
      .send({ email: emails[role as keyof typeof emails], role: r })
      .expect(201);
  }
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('rbac e2e', () => {
  it('owner tạo project thì thành OWNER và thấy trong danh sách', async () => {
    const list = await request(app.getHttpServer())
      .get('/api/projects')
      .set(auth(tokens.owner))
      .expect(200);
    expect((list.body as Array<{ id: string }>).some((p) => p.id === projectId)).toBe(true);
  });

  it('ma trận quyền: MANAGER sửa được, TESTER/VIEWER bị 403', async () => {
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}`)
      .set(auth(tokens.manager))
      .send({ name: `RBAC-edit-${suffix}` })
      .expect(200);
    for (const role of ['tester', 'viewer']) {
      const res = await request(app.getHttpServer())
        .patch(`/api/projects/${projectId}`)
        .set(auth(tokens[role]))
        .send({ name: 'hack' })
        .expect(403);
      expect(res.body.code).toBe('PROJECT_FORBIDDEN');
    }
  });

  it('TESTER không thêm được member (403)', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set(auth(tokens.tester))
      .send({ email: emails.outsider, role: 'VIEWER' })
      .expect(403);
  });

  it('người ngoài project bị 403, đổi vai trò có hiệu lực ngay', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectId}`)
      .set(auth(tokens.outsider))
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/members/${userIds.viewer}`)
      .set(auth(tokens.owner))
      .send({ role: 'TESTER' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/members`)
      .set(auth(tokens.viewer))
      .send({ email: emails.outsider, role: 'VIEWER' })
      .expect(403);
  });

  it('không hạ quyền/xóa Owner cuối cùng', async () => {
    const demote = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/members/${userIds.owner}`)
      .set(auth(tokens.owner))
      .send({ role: 'MANAGER' })
      .expect(403);
    expect(demote.body.code).toBe('MEMBER_LAST_OWNER');
    const remove = await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/members/${userIds.owner}`)
      .set(auth(tokens.owner))
      .expect(403);
    expect(remove.body.code).toBe('MEMBER_LAST_OWNER');
  });

  it('thao tác member có audit event', async () => {
    const members = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/members`)
      .set(auth(tokens.owner))
      .expect(200);
    expect((members.body as Array<unknown>).length).toBe(4);
  });
});
