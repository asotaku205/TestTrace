// E2E sinh draft từ path/decision (nguồn: GEN-PATH-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `gen-${suffix}@example.com`;

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
let analysisId = '';
let paths: string[][] = [];
let decisionId = '';

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
    .send({ name: `GEN-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const analysis = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/analyses`)
    .set(auth())
    .send({ language: 'typescript', source: SOURCE })
    .expect(201);
  analysisId = analysis.body.id as string;
  const detail = await request(app.getHttpServer())
    .get(`/api/projects/${projectId}/analyses/${analysisId}`)
    .set(auth())
    .expect(200);
  paths = (detail.body.metrics as { paths: string[][] }).paths;
  const graph = detail.body.graph as { nodes: Array<{ id: string; type: string }> };
  decisionId = graph.nodes.find((n) => n.type === 'DECISION')?.id ?? '';
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('generate from path e2e', () => {
  it('sinh draft từ path với predicates và NEEDS_REVIEW', async () => {
    const draft = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts/from-path`)
      .set(auth())
      .send({ analysisId, path: paths[0] })
      .expect(201);
    expect(draft.body.technique).toBe('path');
    expect(draft.body.oracleStatus).toBe('NEEDS_REVIEW');
    // Oracle gợi ý từ chạy thử (GEN-ORACLE-01): có expected, ghi chú nói rõ cần xác nhận.
    expect(typeof draft.body.expectedResult).toBe('string');
    expect(draft.body.expectedResult.length).toBeGreaterThan(0);
    expect(
      (draft.body.assumptions as string[]).some((a) => a.includes('expected gợi ý từ chạy thử')),
    ).toBe(true);
    const dup = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts/from-path`)
      .set(auth())
      .send({ analysisId, path: paths[0] })
      .expect(201);
    expect(dup.body.deduped).toBe(true);
  });

  it('sinh draft từ decision node', async () => {
    const draft = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts/from-decision`)
      .set(auth())
      .send({ analysisId, nodeId: decisionId })
      .expect(201);
    expect(draft.body.technique).toBe('branch');
  });

  it('node không thuộc graph bị 404', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts/from-path`)
      .set(auth())
      .send({ analysisId, path: ['khong-co'] })
      .expect(404);
    expect(res.body.code).toBe('DRAFT_SOURCE');
  });
});
