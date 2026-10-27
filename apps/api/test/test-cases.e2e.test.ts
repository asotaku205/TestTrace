// E2E suite/test case: cây suite, steps, READY rule, revision, clone, search (nguồn: TEST-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `test-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let requirementId = '';
let suiteId = '';
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
    .send({ name: `TEST-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const req = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Cần test' })
    .expect(201);
  requirementId = req.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('test repository e2e', () => {
  it('tạo suite cha-con và chặn xóa suite còn nội dung', async () => {
    const parent = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/suites`)
      .set(auth())
      .send({ name: 'Smoke' })
      .expect(201);
    const child = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/suites`)
      .set(auth())
      .send({ name: 'Đăng nhập', parentId: parent.body.id })
      .expect(201);
    suiteId = child.body.id as string;
    const blocked = await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/suites/${parent.body.id}`)
      .set(auth())
      .expect(409);
    expect(blocked.body.code).toBe('SUITE_NOT_EMPTY');
  });

  it('tạo test case sinh mã TC-001 và steps có thứ tự', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases`)
      .set(auth())
      .send({ title: 'Đăng nhập đúng', suiteId, priority: 'HIGH', tags: ['smoke'] })
      .expect(201);
    expect(created.body.code).toBe('TC-001');
    caseId = created.body.id as string;
    const s1 = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${caseId}/steps`)
      .set(auth())
      .send({ action: 'Nhập email', expected: 'Ô email nhận' })
      .expect(201);
    const s2 = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${caseId}/steps`)
      .set(auth())
      .send({ action: 'Nhập password' })
      .expect(201);
    expect(s2.body.position).toBe((s1.body.position as number) + 1);
    const reordered = await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/test-cases/${caseId}/steps/order`)
      .set(auth())
      .send({ order: [s2.body.id, s1.body.id] })
      .expect(200);
    expect((reordered.body as Array<{ id: string }>).map((s) => s.id)).toEqual([
      s2.body.id,
      s1.body.id,
    ]);
  });

  it('READY bị chặn khi thiếu expected + link, kèm gaps', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${caseId}/ready`)
      .set(auth())
      .expect(409);
    expect(res.body.code).toBe('TESTCASE_NOT_READY');
  });

  it('gắn requirement + expected rồi READY thành công', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${caseId}/links`)
      .set(auth())
      .send({ requirementId })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/test-cases/${caseId}`)
      .set(auth())
      .send({ expectedResult: 'Vào được dashboard' })
      .expect(200);
    const ready = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${caseId}/ready`)
      .set(auth())
      .expect(201);
    expect(ready.body.status).toBe('READY');
  });

  it('sửa test READY sinh revision và về DRAFT', async () => {
    const updated = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/test-cases/${caseId}`)
      .set(auth())
      .send({ title: 'Đăng nhập đúng (sửa)' })
      .expect(200);
    expect(updated.body.status).toBe('DRAFT');
    const revisions = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases/${caseId}/revisions`)
      .set(auth())
      .expect(200);
    expect((revisions.body as Array<unknown>).length).toBe(1);
  });

  it('clone giữ steps và trace link, mã mới', async () => {
    const copy = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${caseId}/clone`)
      .set(auth())
      .expect(201);
    expect(copy.body.code).toBe('TC-002');
    expect(copy.body.status).toBe('DRAFT');
    expect((copy.body.steps as Array<unknown>).length).toBe(2);
    expect((copy.body.links as Array<unknown>).length).toBe(1);
  });

  it('search theo mã, tag, requirement; retire khóa chỉnh sửa', async () => {
    const byCode = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases?q=TC-001`)
      .set(auth())
      .expect(200);
    expect((byCode.body as Array<{ code: string }>).some((c) => c.code === 'TC-001')).toBe(true);
    const byTag = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases?tag=smoke`)
      .set(auth())
      .expect(200);
    expect((byTag.body as Array<unknown>).length).toBeGreaterThan(0);
    const byReq = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases?requirementId=${requirementId}`)
      .set(auth())
      .expect(200);
    expect((byReq.body as Array<unknown>).length).toBe(2);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${caseId}/retire`)
      .set(auth())
      .expect(201);
    const locked = await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/test-cases/${caseId}`)
      .set(auth())
      .send({ title: 'sửa sau retire' })
      .expect(403);
    expect(locked.body.code).toBe('TESTCASE_RETIRED');
  });

  it('phân trang test-cases: envelope + total đúng, pageSize sai -> 400', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/test-cases`)
        .set(auth())
        .send({ title: `Paging case ${i}` })
        .expect(201);
    }
    const legacy = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases`)
      .set(auth())
      .expect(200);
    expect(Array.isArray(legacy.body)).toBe(true);
    const total = (legacy.body as unknown[]).length;
    expect(total).toBeGreaterThanOrEqual(3);
    const p2 = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases?page=2&pageSize=2`)
      .set(auth())
      .expect(200);
    expect(p2.body.total).toBe(total);
    expect(p2.body.page).toBe(2);
    expect((p2.body.items as unknown[]).length).toBe(Math.min(2, Math.max(0, total - 2)));
    const bad = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases?page=1&pageSize=0`)
      .set(auth())
      .expect(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });
});
