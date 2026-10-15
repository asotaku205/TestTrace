// E2E thực thi run + finalize + optimistic locking (nguồn: RUN-02).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `exec-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let runId = '';
let itemIds: string[] = [];

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
    .send({ name: `EXEC-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const release = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases`)
    .set(auth())
    .send({ name: 'v1' })
    .expect(201);
  const build = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases/${release.body.id}/builds`)
    .set(auth())
    .send({ number: '1' })
    .expect(201);
  const env = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/environments`)
    .set(auth())
    .send({ name: 'Test' })
    .expect(201);
  const suite = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/suites`)
    .set(auth())
    .send({ name: 'Smoke' })
    .expect(201);
  for (const title of ['Case một', 'Case hai']) {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases`)
      .set(auth())
      .send({ title, suiteId: suite.body.id, expectedResult: 'OK' })
      .expect(201);
  }
  const run = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/runs`)
    .set(auth())
    .send({
      name: 'Run exec',
      releaseId: release.body.id,
      buildId: build.body.id,
      environmentId: env.body.id,
      suiteId: suite.body.id,
    })
    .expect(201);
  runId = run.body.id as string;
  itemIds = (run.body.items as Array<{ id: string }>).map((i) => i.id);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('run execution e2e', () => {
  it('FAIL thiếu actual và BLOCKED thiếu lý do bị 400', async () => {
    const fail = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${runId}/items/${itemIds[0]}/result`)
      .set(auth())
      .send({ status: 'FAIL' })
      .expect(400);
    expect(fail.body.code).toBe('RESULT_VALIDATION');
    const blocked = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${runId}/items/${itemIds[1]}/result`)
      .set(auth())
      .send({ status: 'BLOCKED' })
      .expect(400);
    expect(blocked.body.code).toBe('RESULT_VALIDATION');
  });

  it('ghi PASS + FAIL và progress realtime 50%', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${runId}/items/${itemIds[0]}/result`)
      .set(auth())
      .send({ status: 'PASS' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${runId}/items/${itemIds[1]}/result`)
      .set(auth())
      .send({ status: 'FAIL', actualResult: 'Crash khi mở' })
      .expect(201);
    const detail = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/runs/${runId}`)
      .set(auth())
      .expect(200);
    expect(detail.body.progress).toMatchObject({ done: 2, total: 2, percent: 100 });
  });

  it('finalize version cũ bị 409; đúng version thì bất biến + summary', async () => {
    const stale = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${runId}/finalize`)
      .set(auth())
      .send({ version: 999 })
      .expect(409);
    expect(stale.body.code).toBe('RUN_VERSION_CONFLICT');
    const done = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${runId}/finalize`)
      .set(auth())
      .send({ version: 1 })
      .expect(201);
    expect(done.body.status).toBe('FINALIZED');
    expect(done.body.summary).toMatchObject({ PASS: 1, FAIL: 1 });
    const locked = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${runId}/items/${itemIds[0]}/result`)
      .set(auth())
      .send({ status: 'PASS' })
      .expect(409);
    expect(locked.body.code).toBe('RUN_FINALIZED');
  });
});
