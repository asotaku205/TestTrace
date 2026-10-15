// E2E defect lifecycle + quyền transition (nguồn: BUG-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `bug-${suffix}@example.com`;
const testerEmail = `bug-tester-${suffix}@example.com`;

let app: INestApplication;
let ownerToken = '';
let testerToken = '';
let projectId = '';
let buildId = '';
let defectId = '';

function auth(t: string) {
  return { Authorization: `Bearer ${t}` };
}

function transition(token: string, id: string, to: string, fixedBuildId?: string) {
  return request(app.getHttpServer())
    .post(`/api/projects/${projectId}/defects/${id}/transition`)
    .set(auth(token))
    .send({ to, ...(fixedBuildId ? { fixedBuildId } : {}) });
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  for (const mail of [email, testerEmail]) {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: mail, password })
      .expect(201);
  }
  const ownerLogin = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  ownerToken = ownerLogin.body.accessToken as string;
  const testerLogin = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: testerEmail, password })
    .expect(201);
  testerToken = testerLogin.body.accessToken as string;
  const project = await request(app.getHttpServer())
    .post('/api/projects')
    .set(auth(ownerToken))
    .send({ name: `BUG-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/members`)
    .set(auth(ownerToken))
    .send({ email: testerEmail, role: 'TESTER' })
    .expect(201);
  const release = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases`)
    .set(auth(ownerToken))
    .send({ name: 'v1' })
    .expect(201);
  const build = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/releases/${release.body.id}/builds`)
    .set(auth(ownerToken))
    .send({ number: '2' })
    .expect(201);
  buildId = build.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('defect e2e', () => {
  it('tạo defect sinh mã BUG-001, severity sai bị 400', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/defects`)
      .set(auth(testerToken))
      .send({
        title: 'Crash khi lưu',
        severity: 'CRITICAL',
        stepsToReproduce: '1. Mở form 2. Bấm lưu',
      })
      .expect(201);
    expect(created.body.code).toBe('BUG-001');
    defectId = created.body.id as string;
    const bad = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/defects`)
      .set(auth(testerToken))
      .send({ title: 'Sai severity', severity: 'PANIC' })
      .expect(400);
    expect(bad.body.code).toBe('VALIDATION_ERROR');
  });

  it('TESTER không triage được (403), OWNER đi full luồng tới CLOSED', async () => {
    const denied = await transition(testerToken, defectId, 'TRIAGED').expect(403);
    expect(denied.body.code).toBe('PROJECT_FORBIDDEN');
    for (const to of ['TRIAGED', 'ASSIGNED', 'IN_PROGRESS']) {
      await transition(ownerToken, defectId, to).expect(201);
    }
    const noBuild = await transition(ownerToken, defectId, 'FIXED').expect(400);
    expect(noBuild.body.code).toBe('DEFECT_FIXED_BUILD');
    await transition(ownerToken, defectId, 'FIXED', buildId).expect(201);
    await transition(ownerToken, defectId, 'RETEST').expect(201);
    const closed = await transition(testerToken, defectId, 'CLOSED').expect(201);
    expect(closed.body.status).toBe('CLOSED');
  });

  it('nhảy cóc bị 409; terminal không chuyển tiếp được', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/defects`)
      .set(auth(ownerToken))
      .send({ title: 'Nhảy cóc' })
      .expect(201);
    const jump = await transition(ownerToken, created.body.id, 'FIXED', buildId).expect(409);
    expect(jump.body.code).toBe('DEFECT_STATE');
    const stuck = await transition(ownerToken, defectId, 'REOPENED').expect(409);
    expect(stuck.body.code).toBe('DEFECT_STATE');
  });

  it('timeline ghi đủ lịch sử theo thứ tự', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/defects/${defectId}`)
      .set(auth(ownerToken))
      .expect(200);
    const flow = (res.body.history as Array<{ from: string; to: string }>).map((h) => h.to);
    expect(flow).toEqual(['TRIAGED', 'ASSIGNED', 'IN_PROGRESS', 'FIXED', 'RETEST', 'CLOSED']);
  });
});
