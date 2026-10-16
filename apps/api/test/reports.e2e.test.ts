// E2E export CSV khớp số UI (nguồn: REPORT-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `report-${suffix}@example.com`;

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
    .send({ name: `REPORT-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Cần báo cáo' })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/defects`)
    .set(auth())
    .send({ title: 'Lỗi báo cáo', severity: 'MAJOR' })
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('reports e2e', () => {
  it('CSV RTM chứa header + mã requirement', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/reports/rtm.csv`)
      .set(auth())
      .expect(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('requirement_code');
    expect(res.text).toContain('REQ-001');
  });

  it('CSV execution và defects khớp số UI', async () => {
    const runs = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/runs`)
      .set(auth())
      .expect(200);
    const defects = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/defects`)
      .set(auth())
      .expect(200);
    const execution = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/reports/execution.csv`)
      .set(auth())
      .expect(200);
    const defectCsv = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/reports/defects.csv`)
      .set(auth())
      .expect(200);
    expect((runs.body as Array<unknown>).length).toBe(0);
    expect(execution.text.split('\n').filter((l) => l.length > 0).length).toBe(1);
    expect((defects.body as Array<{ code: string }>)[0].code).toBe('BUG-001');
    expect(defectCsv.text).toContain('BUG-001');
  });
});
