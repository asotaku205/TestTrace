// E2E release/build/environment + freeze (nguồn: REL-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `rel-${suffix}@example.com`;
const testerEmail = `rel-tester-${suffix}@example.com`;

let app: INestApplication;
let ownerToken = '';
let testerToken = '';
let projectId = '';
let releaseId = '';

function auth(t: string) {
  return { Authorization: `Bearer ${t}` };
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
    .send({ name: `REL-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/members`)
    .set(auth(ownerToken))
    .send({ email: testerEmail, role: 'TESTER' })
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('release e2e', () => {
  it('tạo release + build + environment', async () => {
    const release = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases`)
      .set(auth(ownerToken))
      .send({ name: 'v1.0' })
      .expect(201);
    expect(release.body.status).toBe('DRAFT');
    releaseId = release.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases/${releaseId}/builds`)
      .set(auth(ownerToken))
      .send({ number: '12' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/environments`)
      .set(auth(ownerToken))
      .send({ name: 'Test' })
      .expect(201);
  });

  it('build trùng number trong release bị 409', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases/${releaseId}/builds`)
      .set(auth(ownerToken))
      .send({ number: '12' })
      .expect(409);
    expect(res.body.code).toBe('BUILD_EXISTS');
  });

  it('transition đúng luồng; nhảy cóc bị 409', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases/${releaseId}/transition`)
      .set(auth(ownerToken))
      .send({ to: 'IN_TEST' })
      .expect(201);
    const bad = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases/${releaseId}/transition`)
      .set(auth(ownerToken))
      .send({ to: 'RELEASED' })
      .expect(409);
    expect(bad.body.code).toBe('RELEASE_STATE');
  });

  it('TESTER không quản trị được release (403)', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases`)
      .set(auth(testerToken))
      .send({ name: 'hack' })
      .expect(403);
    expect(res.body.code).toBe('PROJECT_FORBIDDEN');
  });

  it('freeze chặn thêm build', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases/${releaseId}/freeze`)
      .set(auth(ownerToken))
      .expect(201);
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/releases/${releaseId}/builds`)
      .set(auth(ownerToken))
      .send({ number: '13' })
      .expect(403);
    expect(res.body.code).toBe('RELEASE_FROZEN');
  });

  it('xóa environment chưa có run được', async () => {
    const env = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/environments`)
      .set(auth(ownerToken))
      .send({ name: 'Tạm' })
      .expect(201);
    await request(app.getHttpServer())
      .delete(`/api/projects/${projectId}/environments/${env.body.id}`)
      .set(auth(ownerToken))
      .expect(200);
  });
});
