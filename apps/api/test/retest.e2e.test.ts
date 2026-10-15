// E2E tạo defect từ Fail + retest link (nguồn: BUG-02).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `retest-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let releaseId = '';
let build1 = '';
let build2 = '';
let envId = '';
let suiteId = '';
let caseId = '';
let runId = '';
let itemId = '';

function auth() {
  return { Authorization: `Bearer ${token}` };
}

function api(method: 'post' | 'get' | 'patch', path: string, body?: unknown) {
  const req = request(app.getHttpServer())[method](path).set(auth());
  return body ? req.send(body) : req;
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  await api('post', '/api/auth/register', { email, password }).expect(201);
  const login = await api('post', '/api/auth/login', { email, password }).expect(201);
  token = login.body.accessToken as string;
  const project = await api('post', '/api/projects', { name: `RETEST-${suffix}` }).expect(201);
  projectId = project.body.id as string;
  const release = await api('post', `/api/projects/${projectId}/releases`, { name: 'v1' }).expect(
    201,
  );
  releaseId = release.body.id as string;
  const b1 = await api('post', `/api/projects/${projectId}/releases/${releaseId}/builds`, {
    number: '1',
  }).expect(201);
  build1 = b1.body.id as string;
  const b2 = await api('post', `/api/projects/${projectId}/releases/${releaseId}/builds`, {
    number: '2',
  }).expect(201);
  build2 = b2.body.id as string;
  const env = await api('post', `/api/projects/${projectId}/environments`, { name: 'Test' }).expect(
    201,
  );
  envId = env.body.id as string;
  const suite = await api('post', `/api/projects/${projectId}/suites`, { name: 'Smoke' }).expect(
    201,
  );
  suiteId = suite.body.id as string;
  const testCase = await api('post', `/api/projects/${projectId}/test-cases`, {
    title: 'Lỗi cần retest',
    suiteId,
    expectedResult: 'OK',
  }).expect(201);
  caseId = testCase.body.id as string;
  const run = await api('post', `/api/projects/${projectId}/runs`, {
    name: 'Run gốc',
    releaseId,
    buildId: build1,
    environmentId: envId,
    suiteId,
  }).expect(201);
  runId = run.body.id as string;
  itemId = (run.body.items as Array<{ id: string }>)[0].id as string;
  await api('post', `/api/projects/${projectId}/runs/${runId}/items/${itemId}/result`, {
    status: 'FAIL',
    actualResult: 'Crash',
  }).expect(201);
  await api('post', `/api/projects/${projectId}/runs/${runId}/finalize`, { version: 1 }).expect(
    201,
  );
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('retest e2e', () => {
  it('tạo defect từ kết quả Fail giữ link result', async () => {
    const detail = await api('get', `/api/projects/${projectId}/runs/${runId}`).expect(200);
    const resultId = (detail.body.items as Array<{ results: Array<{ id: string }> }>)[0].results[0]
      .id as string;
    const defect = await api('post', `/api/projects/${projectId}/defects/from-result`, {
      resultId,
      severity: 'MAJOR',
    }).expect(201);
    expect(defect.body.sourceResultId).toBe(resultId);
    expect(defect.body.status).toBe('NEW');
  });

  it('tạo defect từ kết quả PASS bị chặn', async () => {
    const run = await api('post', `/api/projects/${projectId}/runs`, {
      name: 'Run pass',
      releaseId,
      buildId: build1,
      environmentId: envId,
      testCaseIds: [caseId],
    }).expect(201);
    const item = (run.body.items as Array<{ id: string }>)[0].id as string;
    await api('post', `/api/projects/${projectId}/runs/${run.body.id}/items/${item}/result`, {
      status: 'PASS',
    }).expect(201);
    const detail = await api('get', `/api/projects/${projectId}/runs/${run.body.id}`).expect(200);
    const resultId = (detail.body.items as Array<{ results: Array<{ id: string }> }>)[0].results[0]
      .id as string;
    const res = await api('post', `/api/projects/${projectId}/defects/from-result`, {
      resultId,
    }).expect(409);
    expect(res.body.code).toBe('DEFECT_SOURCE');
  });

  it('đi full luồng tới FIXED, retest trên build mới, PASS thì CLOSED', async () => {
    const list = await api('get', `/api/projects/${projectId}/defects`).expect(200);
    const defectId = (list.body as Array<{ id: string; status: string }>).find(
      (d) => d.status === 'NEW',
    )?.id as string;
    for (const to of ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS']) {
      await api('post', `/api/projects/${projectId}/defects/${defectId}/transition`, { to }).expect(
        201,
      );
    }
    await api('post', `/api/projects/${projectId}/defects/${defectId}/transition`, {
      to: 'FIXED',
      fixedBuildId: build2,
    }).expect(201);
    const retest = await api('post', `/api/projects/${projectId}/defects/${defectId}/retest`, {
      buildId: build2,
      environmentId: envId,
    }).expect(201);
    expect(retest.body.retestRunId).toBeDefined();
    const retestRun = await api(
      'get',
      `/api/projects/${projectId}/runs/${retest.body.retestRunId}`,
    ).expect(200);
    const retestItem = (retestRun.body.items as Array<{ id: string }>)[0].id as string;
    await api(
      'post',
      `/api/projects/${projectId}/runs/${retest.body.retestRunId}/items/${retestItem}/result`,
      { status: 'PASS' },
    ).expect(201);
    const retestDetail = await api(
      'get',
      `/api/projects/${projectId}/runs/${retest.body.retestRunId}`,
    ).expect(200);
    const passResultId = (retestDetail.body.items as Array<{ results: Array<{ id: string }> }>)[0]
      .results[0].id as string;
    const closed = await api(
      'post',
      `/api/projects/${projectId}/defects/${defectId}/retest-resolve`,
      {
        resultId: passResultId,
      },
    ).expect(201);
    expect(closed.body.status).toBe('CLOSED');
  });

  it('retest FAIL thì REOPENED', async () => {
    const run = await api('post', `/api/projects/${projectId}/runs`, {
      name: 'Run fail 2',
      releaseId,
      buildId: build1,
      environmentId: envId,
      testCaseIds: [caseId],
    }).expect(201);
    const item = (run.body.items as Array<{ id: string }>)[0].id as string;
    await api('post', `/api/projects/${projectId}/runs/${run.body.id}/items/${item}/result`, {
      status: 'FAIL',
      actualResult: 'Vẫn crash',
    }).expect(201);
    const detail = await api('get', `/api/projects/${projectId}/runs/${run.body.id}`).expect(200);
    const resultId = (detail.body.items as Array<{ results: Array<{ id: string }> }>)[0].results[0]
      .id as string;
    const defect = await api('post', `/api/projects/${projectId}/defects/from-result`, {
      resultId,
    }).expect(201);
    const defectId = defect.body.id as string;
    for (const to of ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS']) {
      await api('post', `/api/projects/${projectId}/defects/${defectId}/transition`, { to }).expect(
        201,
      );
    }
    await api('post', `/api/projects/${projectId}/defects/${defectId}/transition`, {
      to: 'FIXED',
      fixedBuildId: build2,
    }).expect(201);
    const retest = await api('post', `/api/projects/${projectId}/defects/${defectId}/retest`, {
      buildId: build2,
      environmentId: envId,
    }).expect(201);
    const retestRun = await api(
      'get',
      `/api/projects/${projectId}/runs/${retest.body.retestRunId}`,
    ).expect(200);
    const retestItem = (retestRun.body.items as Array<{ id: string }>)[0].id as string;
    await api(
      'post',
      `/api/projects/${projectId}/runs/${retest.body.retestRunId}/items/${retestItem}/result`,
      { status: 'FAIL', actualResult: 'Chưa hết' },
    ).expect(201);
    const retestDetail = await api(
      'get',
      `/api/projects/${projectId}/runs/${retest.body.retestRunId}`,
    ).expect(200);
    const failResultId = (retestDetail.body.items as Array<{ results: Array<{ id: string }> }>)[0]
      .results[0].id as string;
    const reopened = await api(
      'post',
      `/api/projects/${projectId}/defects/${defectId}/retest-resolve`,
      {
        resultId: failResultId,
      },
    ).expect(201);
    expect(reopened.body.status).toBe('REOPENED');
  });
});
