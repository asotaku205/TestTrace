// E2E orchestrator phân tích: idempotency, unknown adapter, syntax error (nguồn: ANALYSIS-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `analysis-${suffix}@example.com`;

const SOURCE = `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`;

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
    .send({ name: `ANALYSIS-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('analysis e2e', () => {
  it('phân tích thành công kèm metrics', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'typescript', source: SOURCE, name: 'fee' })
      .expect(201);
    expect(res.body.status).toBe('SUCCEEDED');
    expect(res.body.metrics).toMatchObject({ complexity: 2, decisions: 1 });
    expect((res.body.graph.nodes as Array<unknown>).length).toBe(5);
  });

  it('cùng input trả cùng analysis (idempotent, không nhân bản)', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'typescript', source: SOURCE })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'typescript', source: SOURCE })
      .expect(201);
    expect(second.body.id).toBe(first.body.id);
  });

  it('ngôn ngữ chưa có adapter trả 400 kèm danh sách', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'cobol', source: 'x' })
      .expect(400);
    expect(res.body.code).toBe('ADAPTER_UNKNOWN');
    expect(res.body.adapters).toContain('javascript-typescript');
  });

  it('cú pháp lỗi lưu FAILED, không có graph nửa vời', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/analyses`)
      .set(auth())
      .send({ language: 'javascript', source: 'function broken( {' })
      .expect(201);
    expect(res.body.status).toBe('FAILED');
    expect(res.body.graph).toBeNull();
    expect((res.body.diagnostics as Array<{ kind: string }>)[0].kind).toBe('syntax-error');
  });
});
