// E2E evidence: upload thật, MIME giả, quá lớn, traversal, quyền tải (nguồn: EVID-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

// PNG 1x1 hợp lệ tối thiểu.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const email = `evid-${suffix}@example.com`;
const outsiderEmail = `evid-out-${suffix}@example.com`;

let app: INestApplication;
let token = '';
let outsiderToken = '';
let projectId = '';
let defectId = '';

function auth(t: string) {
  return { Authorization: `Bearer ${t}` };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  for (const mail of [email, outsiderEmail]) {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: mail, password })
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
    .send({ name: `EVID-${suffix}` })
    .expect(201);
  projectId = project.body.id as string;
  const defect = await request(app.getHttpServer())
    .post(`/api/projects/${projectId}/defects`)
    .set(auth(token))
    .send({ title: 'Lỗi cần ảnh' })
    .expect(201);
  defectId = defect.body.id as string;
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('evidence e2e', () => {
  it('upload PNG gắn defect rồi tải lại đúng nội dung', async () => {
    const upload = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/evidence?entityType=defect&entityId=${defectId}`)
      .set(auth(token))
      .attach('file', PNG, 'loi.png')
      .expect(201);
    expect(upload.body.checksum).toBeDefined();
    const download = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/evidence/${upload.body.id}/download`)
      .set(auth(token))
      .expect(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(Buffer.compare(download.body as Buffer, PNG)).toBe(0);
  });

  it('MIME giả (text đội lốt png) bị 400', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/evidence?entityType=defect&entityId=${defectId}`)
      .set(auth(token))
      .attach('file', Buffer.from('khong phai anh'), 'gia.png')
      .expect(400);
    expect(res.body.code).toBe('EVIDENCE_TYPE');
  });

  it('file quá 10MB bị chặn', async () => {
    const big = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/evidence?entityType=defect&entityId=${defectId}`)
      .set(auth(token))
      .attach('file', big, 'to.bin')
      .expect(400);
    expect(['EVIDENCE_TOO_LARGE', 'EVIDENCE_TYPE']).toContain(res.body.code);
  });

  it('người ngoài project không tải được (403)', async () => {
    const upload = await request(app.getHttpServer())
      .post(`/api/projects/${projectId}/evidence?entityType=defect&entityId=${defectId}`)
      .set(auth(token))
      .attach('file', PNG, 'rieng.png')
      .expect(201);
    const res = await request(app.getHttpServer())
      .get(`/api/projects/${projectId}/evidence/${upload.body.id}/download`)
      .set(auth(outsiderToken))
      .expect(403);
    expect(res.body.code).toBe('PROJECT_FORBIDDEN');
  });
});
