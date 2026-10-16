// E2E evaluate gate: Fail → sửa → Pass + snapshot bất biến (nguồn: GATE-03).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `gateeval-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let gateId = '';
let buildId = '';
let releaseId = '';

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
    .send({ name: `GATEEVAL-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;

  const req = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Rủi ro cao' })
    .expect(201);
  await request(app.getHttpServer())
    .put(`/api/projects/${projectId}/requirements/${req.body.id}/risk`)
    .set(auth())
    .send({ impact: 5, likelihood: 4 })
    .expect(200);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements/${req.body.id}/approve`)
    .set(auth())
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/defects`)
    .set(auth())
    .send({ title: 'Crash blocker', severity: 'CRITICAL' })
    .expect(201);

  const release = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases`)
    .set(auth())
    .send({ name: 'v1' })
    .expect(201);
  releaseId = release.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases/${releaseId}/transition`)
    .set(auth())
    .send({ to: 'IN_TEST' })
    .expect(201);
  const build = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases/${releaseId}/builds`)
    .set(auth())
    .send({ number: '1' })
    .expect(201);
  buildId = build.body.id as string;

  const gate = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/gates`)
    .set(auth())
    .send({
      name: 'Release gate',
      yaml: 'uncovered_high_risk_requirements: 0\nopen_critical_defects: 0\n',
    })
    .expect(201);
  gateId = gate.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/gates/${gateId}/publish`)
    .set(auth())
    .send({ version: 1 })
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('gate evaluate e2e', () => {
  it('Fail với drill-down khi còn uncovered + critical mở', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates/${gateId}/evaluate`)
      .set(auth())
      .send({ buildId })
      .expect(201);
    expect(res.body.verdict).toBe('FAIL');
    const uncovered = (
      res.body.results as Array<{ rule: string; drilldown?: { ids: string[] } }>
    ).find((r) => r.rule === 'uncovered_high_risk_requirements');
    expect((uncovered?.drilldown?.ids ?? []).length).toBeGreaterThan(0);
  });

  it('sửa dữ liệu xong evaluate lại Pass, release PASSED, lịch sử bất biến', async () => {
    const defects = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/defects`)
      .set(auth())
      .expect(200);
    const defectId = (defects.body as Array<{ id: string }>)[0].id as string;
    for (const to of ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS']) {
      await request(app.getHttpServer())
        .post(`/api/projects/${projectId}/defects/${defectId}/transition`)
        .set(auth())
        .send({ to })
        .expect(201);
    }
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/defects/${defectId}/transition`)
      .set(auth())
      .send({ to: 'FIXED', fixedBuildId: buildId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/defects/${defectId}/transition`)
      .set(auth())
      .send({ to: 'RETEST' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/defects/${defectId}/transition`)
      .set(auth())
      .send({ to: 'CLOSED' })
      .expect(201);
    const reqs = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/rtm`)
      .set(auth())
      .expect(200);
    const uncoveredId = (reqs.body as Array<{ requirementId: string; status: string }>).find(
      (r) => r.status === 'UNCOVERED',
    )?.requirementId as string;
    const testCase = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases`)
      .set(auth())
      .send({ title: 'Cover rủi ro', expectedResult: 'OK' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${testCase.body.id}/links`)
      .set(auth())
      .send({ requirementId: uncoveredId })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/test-cases/${testCase.body.id}/ready`)
      .set(auth())
      .expect(201);
    const pass = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates/${gateId}/evaluate`)
      .set(auth())
      .send({ buildId })
      .expect(201);
    expect(pass.body.verdict).toBe('PASS');
    const release = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/releases/${releaseId}`)
      .set(auth())
      .expect(200);
    expect(release.body.status).toBe('PASSED');
    const history = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/gates/${gateId}/evaluations`)
      .set(auth())
      .expect(200);
    expect((history.body as Array<unknown>).length).toBe(2);
  });
});
