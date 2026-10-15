// E2E trace 2 chiều requirement↔test + đánh dấu cần rà soát (nguồn: TRACE-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `trace-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let requirementId = '';
let caseId = '';

function auth() {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password })
    .expect(201);
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  token = login.body.accessToken as string;
  const project = await request(app.getHttpServer())
    .post('/api/projects')
    .set(auth())
    .send({ name: `TRACE-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const req = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Cần truy vết' })
    .expect(201);
  requirementId = req.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements/${requirementId}/approve`)
    .set(auth())
    .expect(201);
  const testCase = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases`)
    .set(auth())
    .send({ title: 'Test truy vết', expectedResult: 'Đạt' })
    .expect(201);
  caseId = testCase.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases/${caseId}/links`)
    .set(auth())
    .send({ requirementId })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases/${caseId}/ready`)
    .set(auth())
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('traceability e2e', () => {
  it('đọc requirement thấy test liên kết (mã + trạng thái)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/requirements/${requirementId}`)
      .set(auth())
      .expect(200);
    const linked = res.body.linkedTests as Array<{ code: string; status: string }>;
    expect(linked.some((t) => t.code.startsWith('TC-') && t.status === 'READY')).toBe(true);
  });

  it('đọc test case thấy requirement liên kết (mã + trạng thái)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases/${caseId}`)
      .set(auth())
      .expect(200);
    const linked = res.body.linkedRequirements as Array<{ code: string; status: string }>;
    expect(linked.some((r) => r.code.startsWith('REQ-') && r.status === 'APPROVED')).toBe(true);
  });

  it('sửa requirement đã duyệt thì phía requirement báo cần rà soát', async () => {
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/requirements/${requirementId}`)
      .set(auth())
      .send({ title: 'Đổi nội dung sau duyệt' })
      .expect(200);
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/requirements/${requirementId}`)
      .set(auth())
      .expect(200);
    expect(res.body.needsReview).toBe(true);
  });

  it('resolve review task xong thì hết báo cần rà soát; gỡ link thì hai chiều trống', async () => {
    const tasks = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/review-tasks?status=OPEN`)
      .set(auth())
      .expect(200);
    for (const task of tasks.body as Array<{ id: string }>) {
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/review-tasks/${task.id}/resolve`)
        .set(auth())
        .expect(201);
    }
    const req = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/requirements/${requirementId}`)
      .set(auth())
      .expect(200);
    expect(req.body.needsReview).toBe(false);
    await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/test-cases/${caseId}/links/${requirementId}`)
      .set(auth())
      .expect(200);
    const reqAfter = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/requirements/${requirementId}`)
      .set(auth())
      .expect(200);
    expect((reqAfter.body.linkedTests as Array<unknown>).length).toBe(0);
    const caseAfter = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases/${caseId}`)
      .set(auth())
      .expect(200);
    expect((caseAfter.body.linkedRequirements as Array<unknown>).length).toBe(0);
  });
});
