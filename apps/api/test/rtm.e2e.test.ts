// E2E RTM: Uncovered → Trusted → Stale → At risk (nguồn: RTM-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `rtm-${suffix}@example.com`;

const V1 = `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`;
const V2 = `function fee(total) {
  if (total >= 100) {
    return 0;
  } else {
    return 5;
  }
}`;

let app: INestApplication;
let token = '';
let projectId = '';
let releaseId = '';
let buildId = '';
let envId = '';
let requirementId = '';
let bareId = '';
let caseId = '';

function auth() {
  return { Authorization: `Bearer ${token}` };
}

async function rtm() {
  const res = await request(app.getHttpServer())
    .get(`/api/projects/${projectId}/rtm?releaseId=${releaseId}`)
    .set(auth())
    .expect(200);
  return res.body as Array<{ requirementId: string; status: string; reasonCodes: string[] }>;
}

function statusOf(rows: Array<{ requirementId: string; status: string }>, id: string) {
  return rows.find((r) => r.requirementId === id)?.status;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  await request(app.getHttpServer()).post('/api/auth/register').send({ email, password }).expect(201);
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  token = login.body.accessToken as string;
  const project = await request(app.getHttpServer())
    .post('/api/projects')
    .set(auth())
    .send({ name: `RTM-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const req = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Cần bảo vệ' })
    .expect(201);
  requirementId = req.body.id as string;
  const bare = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Chưa có test' })
    .expect(201);
  bareId = bare.body.id as string;
  const testCase = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases`)
    .set(auth())
    .send({ title: 'Test bảo vệ', expectedResult: 'OK' })
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
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/analyses`)
    .set(auth())
    .send({ language: 'typescript', source: V1 })
    .expect(201);
  const artifacts = await request(app.getHttpServer())
    .get(`/api/projects/${projectId}/code`)
    .set(auth())
    .expect(200);
  const artifactId = (artifacts.body as Array<{ id: string }>)[0].id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements/${requirementId}/code-units`)
    .set(auth())
    .send({ artifactId, qualifiedName: 'fee' })
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('rtm e2e', () => {
  it('run PASS finalized thì TRUSTED, requirement chưa test thì UNCOVERED', async () => {
    const run = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs`)
      .set(auth())
      .send({ name: 'Run rtm', releaseId, buildId, environmentId: envId, testCaseIds: [caseId] })
      .expect(201);
    const itemId = (run.body.items as Array<{ id: string }>)[0].id as string;
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${run.body.id}/items/${itemId}/result`)
      .set(auth())
      .send({ status: 'PASS' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${run.body.id}/finalize`)
      .set(auth())
      .send({ version: 1 })
      .expect(201);
    const rows = await rtm();
    expect(statusOf(rows, requirementId)).toBe('TRUSTED');
    expect(statusOf(rows, bareId)).toBe('UNCOVERED');
  });

  it('code đổi sau run thì STALE', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'typescript', source: V2 })
      .expect(201);
    const rows = await rtm();
    expect(statusOf(rows, requirementId)).toBe('STALE');
  });

  it('FAIL mới (không đổi code) thì AT_RISK', async () => {
    const req = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/requirements`)
      .set(auth())
      .send({ title: 'Hay hỏng' })
      .expect(201);
    const testCase = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases`)
      .set(auth())
      .send({ title: 'Test hay hỏng', expectedResult: 'OK' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${testCase.body.id}/links`)
      .set(auth())
      .send({ requirementId: req.body.id })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${testCase.body.id}/ready`)
      .set(auth())
      .expect(201);
    const run = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs`)
      .set(auth())
      .send({
        name: 'Run fail',
        releaseId,
        buildId,
        environmentId: envId,
        testCaseIds: [testCase.body.id],
      })
      .expect(201);
    const itemId = (run.body.items as Array<{ id: string }>)[0].id as string;
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${run.body.id}/items/${itemId}/result`)
      .set(auth())
      .send({ status: 'FAIL', actualResult: 'Sai' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/runs/${run.body.id}/finalize`)
      .set(auth())
      .send({ version: 1 })
      .expect(201);
    const rows = await rtm();
    expect(statusOf(rows, req.body.id)).toBe('AT_RISK');
  });
});
