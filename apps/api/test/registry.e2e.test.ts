// E2E code registry: version hóa + link requirement (nguồn: REG-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `reg-${suffix}@example.com`;

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
let requirementId = '';

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
    .send({ name: `REG-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const req = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Cần link code' })
    .expect(201);
  requirementId = req.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('code registry e2e', () => {
  it('phân tích tạo artifact + version + units', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'typescript', source: V1 })
      .expect(201);
    const artifacts = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/code`)
      .set(auth())
      .expect(200);
    expect((artifacts.body as Array<{ name: string }>).some((a) => a.name === 'fee')).toBe(true);
    const artifactId = (artifacts.body as Array<{ id: string }>)[0].id as string;
    const versions = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/code/${artifactId}/versions`)
      .set(auth())
      .expect(200);
    expect(
      (versions.body as Array<{ units: Array<{ qualifiedName: string }> }>)[0].units.some(
        (u) => u.qualifiedName === 'fee',
      ),
    ).toBe(true);
  });

  it('source đổi tạo version mới, source trùng không nhân bản', async () => {
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'typescript', source: V2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'typescript', source: V2 })
      .expect(201);
    const artifacts = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/code`)
      .set(auth())
      .expect(200);
    const artifactId = (artifacts.body as Array<{ id: string }>)[0].id as string;
    const versions = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/code/${artifactId}/versions`)
      .set(auth())
      .expect(200);
    expect((versions.body as Array<unknown>).length).toBe(2);
  });

  it('link requirement–unit 2 chiều, sai project bị chặn', async () => {
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
    const detail = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/requirements/${requirementId}`)
      .set(auth())
      .expect(200);
    expect(
      (detail.body.linkedCodeUnits as Array<{ qualifiedName: string }>).some(
        (u) => u.qualifiedName === 'fee',
      ),
    ).toBe(true);
    const other = await request(app.getHttpServer())
      .post('/api/projects')
      .set(auth())
      .send({ name: `OTHER-${suffix}` })
      .expect(201);
    const bad = await request(app.getHttpServer())
      .post(`/api/projects/${other.body.id}/requirements/${requirementId}/code-units`)
      .set(auth())
      .send({ artifactId, qualifiedName: 'fee' })
      .expect(404);
    expect(bad.body.code).toBe('REQUIREMENT_NOT_FOUND');
  });
});
