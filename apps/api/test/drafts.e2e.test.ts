// E2E draft review: tạo, dedupe, duyệt thành test case, sửa giữ diff, từ chối (nguồn: DRAFT-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `draft-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let projectId = '';
let draftId = '';

const draftBody = {
  technique: 'branch',
  sourceRef: { analysisId: 'a1', decision: 'n2' },
  inputs: { total: 101 },
  expectedResult: '0',
  oracleStatus: 'DEFINED',
  confidence: 80,
};

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
    .send({ name: `DRAFT-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('draft review e2e', () => {
  it('tạo draft và tạo trùng thì gộp (cùng id, giữ nhiều nguồn)', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts`)
      .set(auth())
      .send(draftBody)
      .expect(201);
    draftId = first.body.id as string;
    expect(first.body.deduped).toBe(false);
    const dup = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts`)
      .set(auth())
      .send({ ...draftBody, sourceRef: { analysisId: 'a2', decision: 'n2' } })
      .expect(201);
    expect(dup.body.deduped).toBe(true);
    expect(dup.body.id).toBe(draftId);
    expect((dup.body.sources as Array<unknown>).length).toBe(2);
  });

  it('duyệt draft tạo test case DRAFT kèm trace', async () => {
    const approved = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts/${draftId}/approve`)
      .set(auth())
      .send({ title: 'Test từ draft' })
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');
    expect(approved.body.testCaseId).toBeDefined();
    const testCase = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/test-cases/${approved.body.testCaseId}`)
      .set(auth())
      .expect(200);
    expect(testCase.body.status).toBe('DRAFT');
  });

  it('sửa draft giữ diff và đổi fingerprint', async () => {
    const fresh = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts`)
      .set(auth())
      .send({ ...draftBody, inputs: { total: 50 } })
      .expect(201);
    const edited = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts/${fresh.body.id}/edit`)
      .set(auth())
      .send({ inputs: { total: 51 }, expectedResult: '0' })
      .expect(201);
    expect(edited.body.inputs).toMatchObject({ total: 51 });
    expect(edited.body.fingerprint).not.toBe(fresh.body.fingerprint);
  });

  it('từ chối có lý do; input đổi thì draft mới không bị chặn', async () => {
    const target = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts`)
      .set(auth())
      .send({ ...draftBody, inputs: { total: 70 } })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts/${target.body.id}/reject`)
      .set(auth())
      .send({ reason: 'Không cần thiết' })
      .expect(201);
    const pending = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/drafts?status=PENDING`)
      .set(auth())
      .expect(200);
    expect((pending.body as Array<{ id: string }>).some((d) => d.id === target.body.id)).toBe(
      false,
    );
    const anew = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/drafts`)
      .set(auth())
      .send({ ...draftBody, inputs: { total: 71 } })
      .expect(201);
    expect(anew.body.deduped).toBe(false);
  });
});
