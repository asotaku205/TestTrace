// E2E impact ranking: đổi điều kiện → DIRECT_LINK; no-op → rỗng (nguồn: IMPACT-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `impact-${suffix}@example.com`;

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
let caseId = '';
let v1Id = '';
let v2Id = '';
let artifactId = '';

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
    .send({ name: `IMPACT-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const req = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements`)
    .set(auth())
    .send({ title: 'Tính phí' })
    .expect(201);
  requirementId = req.body.id as string;
  const testCase = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases`)
    .set(auth())
    .send({ title: 'Test phí', expectedResult: 'OK' })
    .expect(201);
  caseId = testCase.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases/${caseId}/links`)
    .set(auth())
    .send({ requirementId })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/test-cases/${caseId}/ready`)
    .set(auth())
    .expect(201);
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/analyses`)
    .set(auth())
    .send({ language: 'typescript', source: V1 })
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
  artifactId = (artifacts.body as Array<{ id: string }>)[0].id as string;
  const versions = await request(app.getHttpServer())
    .get(`/api/projects/${projectId}/code/${artifactId}/versions`)
    .set(auth())
    .expect(200);
  v1Id = (versions.body as Array<{ id: string }>)[0].id as string;
  v2Id = (versions.body as Array<{ id: string }>)[1].id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/requirements/${requirementId}/code-units`)
    .set(auth())
    .send({ artifactId, qualifiedName: 'fee' })
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('impact e2e', () => {
  it('đổi điều kiện đề xuất test với DIRECT_LINK + drill-down', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/impact`)
      .set(auth())
      .send({ fromVersionId: v1Id, toVersionId: v2Id })
      .expect(201);
    expect(res.body.graphDiff.modifiedNodes.length).toBeGreaterThan(0);
    const impacted = res.body.impactedTests as Array<{
      testCaseId: string;
      reasonCodes: string[];
    }>;
    expect(
      impacted.some((t) => t.testCaseId === caseId && t.reasonCodes.includes('DIRECT_LINK')),
    ).toBe(true);
  });

  it('so cùng version thì rỗng', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/impact`)
      .set(auth())
      .send({ fromVersionId: v1Id, toVersionId: v1Id })
      .expect(201);
    expect((res.body.impactedTests as Array<unknown>).length).toBe(0);
  });
});
