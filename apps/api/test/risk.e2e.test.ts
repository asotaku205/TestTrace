// E2E risk scoring + filter (nguồn: REQ-02).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `risk-${suffix}@example.com`;

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
    .send({ name: `RISK-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('risk e2e', () => {
  it('chấm risk trong thang 1–5 trả score = tích', async () => {
    const req = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/requirements`)
      .set(auth())
      .send({ title: 'Rủi ro cao' })
      .expect(201);
    const risk = await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/requirements/${req.body.id}/risk`)
      .set(auth())
      .send({ impact: 5, likelihood: 4 })
      .expect(200);
    expect(risk.body).toMatchObject({ impact: 5, likelihood: 4, score: 20 });
  });

  it('ngoài thang 1–5 → 400 RISK_OUT_OF_RANGE', async () => {
    const req = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/requirements`)
      .set(auth())
      .send({ title: 'Risk sai' })
      .expect(201);
    for (const body of [
      { impact: 0, likelihood: 3 },
      { impact: 3, likelihood: 6 },
    ]) {
      const res = await request(app.getHttpServer())
        .put(`/api/projects/${projectId}/requirements/${req.body.id}/risk`)
        .set(auth())
        .send(body)
        .expect(400);
      expect(res.body.code).toBe('RISK_OUT_OF_RANGE');
    }
  });

  it('lọc risk matrix theo minScore/maxScore', async () => {
    const low = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/requirements`)
      .set(auth())
      .send({ title: 'Rủi ro thấp' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/api/projects/${projectId}/requirements/${low.body.id}/risk`)
      .set(auth())
      .send({ impact: 1, likelihood: 2 })
      .expect(200);
    const filtered = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/requirements?minScore=15`)
      .set(auth())
      .expect(200);
    const codes = (filtered.body as Array<{ code: string }>).map((r) => r.code);
    expect(codes.length).toBeGreaterThan(0);
    for (const item of filtered.body as Array<{ score: number | null }>) {
      expect(item.score).not.toBeNull();
      expect(item.score as number).toBeGreaterThanOrEqual(15);
    }
  });
});
