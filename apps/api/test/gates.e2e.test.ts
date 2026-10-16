// E2E gate schema + publish lock (nguồn: GATE-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `gate-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let gateId = '';

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
    .send({ name: `GATE-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('gate schema e2e', () => {
  it('validate YAML đúng/sai', async () => {
    const ok = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates/validate`)
      .set(auth())
      .send({ yaml: 'open_critical_defects: 0\npass_rate_min: 80\n' })
      .expect(201);
    expect(ok.body.ok).toBe(true);
    const bad = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates/validate`)
      .set(auth())
      .send({ yaml: 'luat_la: 1\n' })
      .expect(201);
    expect(bad.body.ok).toBe(false);
  });

  it('tạo gate + publish khóa version; sửa bản publish bị chặn', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates`)
      .set(auth())
      .send({ name: 'Release gate', yaml: 'open_critical_defects: 0\n' })
      .expect(201);
    gateId = created.body.id as string;
    expect(created.body.versions[0].status).toBe('DRAFT');
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates/${gateId}/publish`)
      .set(auth())
      .send({ version: 1 })
      .expect(201);
    const locked = await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/gates/${gateId}/versions/1/rules`)
      .set(auth())
      .send({ yaml: 'open_critical_defects: 5\n' })
      .expect(409);
    expect(locked.body.code).toBe('GATE_LOCKED');
    const forked = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates/${gateId}/versions`)
      .set(auth())
      .send({})
      .expect(201);
    expect(forked.body.version).toBe(2);
    expect(forked.body.status).toBe('DRAFT');
  });

  it('evaluate thiếu buildId trả 400 VALIDATION_ERROR (không đánh giá nhầm build)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/gates/${gateId}/evaluate`)
      .set(auth())
      .send({})
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
  });
});
