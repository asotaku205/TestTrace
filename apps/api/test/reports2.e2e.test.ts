// E2E export CSV complexity/impact/gate/audit (nguồn: REPORT-02).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `report2-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';

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
    .send({ name: `REPORT2-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/analyses`)
    .set(auth())
    .send({ language: 'typescript', source: 'function f() {\n  return 1;\n}' })
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('reports 2 e2e', () => {
  it('CSV complexity chứa metrics', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/reports/complexity.csv`)
      .set(auth())
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('complexity');
  });

  it('CSV gate/audit/impact trả đúng dạng kể cả khi trống', async () => {
    for (const name of ['gate.csv', 'audit.csv', 'impact.csv']) {
      const res = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}/reports/${name}`)
        .set(auth())
        .expect(200);
      expect(res.text.split('\n')[0].length).toBeGreaterThan(0);
    }
  });
});
