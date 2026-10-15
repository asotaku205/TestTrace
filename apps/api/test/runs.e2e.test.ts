// E2E lập run + snapshot (nguồn: RUN-01 + invariant snapshot).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `run-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let releaseId = '';
let buildId = '';
let envId = '';
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
    .send({ name: `RUN-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const release = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases`)
    .set(auth())
    .send({ name: 'v1' })
    .expect(201);
  releaseId = release.body.id as string;
  const build = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases/${releaseId}/builds`)
    .set(auth())
    .send({ number: '1' })
    .expect(201);
  buildId = build.body.id as string;
  const env = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/environments`)
    .set(auth())
    .send({ name: 'Test' })
    .expect(201);
  envId = env.body.id as string;
  const suite = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/suites`)
    .set(auth())
    .send({ name: 'Smoke' })
    .expect(201);
  suiteId = suite.body.id as string;
  const testCase = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases`)
    .set(auth())
    .send({ title: 'Chạy thử', suiteId, expectedResult: 'OK' })
    .expect(201);
  caseId = testCase.body.id as string;
  const retired = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases`)
    .set(auth())
    .send({ title: 'Đã nghỉ', suiteId })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases/${retired.body.id}/retire`)
    .set(auth())
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('run creation e2e', () => {
  it('lập run từ suite, snapshot revision, loại test RETIRED', async () => {
    const run = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs`)
      .set(auth())
      .send({ name: 'Run 1', releaseId, buildId, environmentId: envId, suiteId })
      .expect(201);
    expect((run.body.items as Array<unknown>).length).toBe(1);
    const item = (run.body.items as Array<{ testCaseId: string; snapshot: { title: string } }>)[0];
    expect(item.testCaseId).toBe(caseId);
    expect(item.snapshot.title).toBe('Chạy thử');
    await request(app.getHttpServer())
      .patch(`/api/projects/${projectId}/test-cases/${caseId}`)
      .set(auth())
      .send({ title: 'Đã sửa sau lập run' })
      .expect(200);
    const detail = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/runs/${run.body.id}`)
      .set(auth())
      .expect(200);
    const same = (detail.body.items as Array<{ snapshot: { title: string } }>)[0];
    expect(same.snapshot.title).toBe('Chạy thử');
  });

  it('build khác release bị 409', async () => {
    const otherRelease = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases`)
      .set(auth())
      .send({ name: 'v2' })
      .expect(201);
    const otherBuild = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases/${otherRelease.body.id}/builds`)
      .set(auth())
      .send({ number: '1' })
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs`)
      .set(auth())
      .send({
        name: 'Run sai',
        releaseId,
        buildId: otherBuild.body.id,
        environmentId: envId,
        suiteId,
      })
      .expect(409);
    expect(res.body.code).toBe('RUN_BUILD_MISMATCH');
  });
});
