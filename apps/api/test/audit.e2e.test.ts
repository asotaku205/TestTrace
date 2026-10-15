// E2E audit read: phân trang, lọc, quyền, empty state (nguồn: AUDIT-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `audit-${suffix}@example.com`;
const outsiderEmail = `audit-out-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let outsiderToken = '';
let projectId = '';

function auth(t: string) {
  return { Authorization: `Bearer ${t}` };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  for (const [mail, pw] of [
    [email, password],
    [outsiderEmail, password],
  ] as const) {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: mail, password: pw })
      .expect(201);
  }
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password })
    .expect(201);
  token = login.body.accessToken as string;
  const outsiderLogin = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email: outsiderEmail, password })
    .expect(201);
  outsiderToken = outsiderLogin.body.accessToken as string;

  const project = await request(app.getHttpServer())
    .post('/api/projects')
    .set(auth(token))
    .send({ name: `AUDIT-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const req = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth(token))
    .send({ title: 'Ghi audit' })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements/${req.body.id}/approve`)
    .set(auth(token))
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('audit e2e', () => {
  it('đọc audit theo project, có phân trang và đúng thứ tự mới trước', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/audit?page=1&pageSize=10`)
      .set(auth(token))
      .expect(200);
    expect(res.body.total).toBeGreaterThanOrEqual(3);
    expect((res.body.items as Array<{ action: string }>).map((e) => e.action)).toContain(
      'requirement.approved',
    );
    const actions = (res.body.items as Array<{ action: string }>).map((e) => e.action);
    expect(actions[0]).toBe('requirement.approved');
  });

  it('lọc theo entityType + entityId', async () => {
    const list = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/audit?entityType=requirement`)
      .set(auth(token))
      .expect(200);
    expect(list.body.total).toBeGreaterThanOrEqual(2);
    for (const item of list.body.items as Array<{ entityType: string }>) {
      expect(item.entityType).toBe('requirement');
    }
  });

  it('người ngoài project bị 403', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/audit`)
      .set(auth(outsiderToken))
      .expect(403);
    expect(res.body.code).toBe('PROJECT_FORBIDDEN');
  });

  it('project mới rỗng có empty state đúng dạng', async () => {
    const project = await request(app.getHttpServer())
      .post('/api/projects')
      .set(auth(token))
      .send({ name: `EMPTY-${suffix}` })
      .expect(201);
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${project.body.id}/audit`)
      .set(auth(token))
      .expect(200);
    const created = (res.body.items as Array<{ action: string }>).filter(
      (e) => e.action === 'project.created',
    );
    expect(res.body.total).toBe(1);
    expect(created.length).toBe(1);
  });
});
