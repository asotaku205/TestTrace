// E2E requirement + criteria: CRUD, approve lifecycle, mã theo project, phân quyền (nguồn: REQ-01).
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const password = 'mat-khau-123';
const ownerEmail = `req-owner-${suffix}@example.com`;
const viewerEmail = `req-viewer-${suffix}@example.com`;
const viewerPassword = 'mat-khau-123';

let app: INestApplication;
let ownerToken = '';
let viewerToken = '';
let projectA = '';
let projectB = '';
let requirementId = '';

async function registerAndLogin(email: string, pw: string): Promise<string> {
  await request(app.getHttpServer())
    .post('/api/auth/register')
    .send({ email, password: pw })
    .expect(201);
  const login = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: pw })
    .expect(201);
  return login.body.accessToken as string;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();

  ownerToken = await registerAndLogin(ownerEmail, password);
  viewerToken = await registerAndLogin(viewerEmail, viewerPassword);
  const a = await request(app.getHttpServer())
    .post('/api/projects')
    .set(auth(ownerToken))
    .send({ name: `REQA-${suffix}` })
    .expect(201);
  projectA = a.body.id as string;
  const b = await request(app.getHttpServer())
    .post('/api/projects')
    .set(auth(ownerToken))
    .send({ name: `REQB-${suffix}` })
    .expect(201);
  projectB = b.body.id as string;
  await request(app.getHttpServer())
    .post(`/api/projects/${projectA}/members`)
    .set(auth(ownerToken))
    .send({ email: viewerEmail, role: 'VIEWER' })
    .expect(201);
}, 60000);

afterAll(async () => {
  await app.close();
});

describe('requirements e2e', () => {
  it('tạo requirement sinh mã REQ-001, REQ-002 tăng dần trong project', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements`)
      .set(auth(ownerToken))
      .send({ title: 'Tính phí giao hàng', description: 'Mô tả' })
      .expect(201);
    expect(first.body.code).toBe('REQ-001');
    expect(first.body.status).toBe('DRAFT');
    requirementId = first.body.id as string;
    const second = await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements`)
      .set(auth(ownerToken))
      .send({ title: 'Áp mã giảm giá' })
      .expect(201);
    expect(second.body.code).toBe('REQ-002');
  });

  it('mã REQ-001 dùng lại được ở project khác', async () => {
    const other = await request(app.getHttpServer())
      .post(`/api/projects/${projectB}/requirements`)
      .set(auth(ownerToken))
      .send({ title: 'Cùng mã khác project' })
      .expect(201);
    expect(other.body.code).toBe('REQ-001');
  });

  it('VIEWER đọc được nhưng viết bị 403', async () => {
    await request(app.getHttpServer())
      .get(`/api/projects/${projectA}/requirements`)
      .set(auth(viewerToken))
      .expect(200);
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements`)
      .set(auth(viewerToken))
      .send({ title: 'hack' })
      .expect(403);
    expect(res.body.code).toBe('PROJECT_FORBIDDEN');
  });

  it('approve DRAFT → APPROVED; approve lại → 409', async () => {
    const approved = await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements/${requirementId}/approve`)
      .set(auth(ownerToken))
      .expect(201);
    expect(approved.body.status).toBe('APPROVED');
    const again = await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements/${requirementId}/approve`)
      .set(auth(ownerToken))
      .expect(409);
    expect(again.body.code).toBe('REQUIREMENT_STATE');
  });

  it('đã APPROVED thì sửa trực tiếp bị 403 (chờ REQ-02)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/projects/${projectA}/requirements/${requirementId}`)
      .set(auth(ownerToken))
      .send({ title: 'sửa lén' })
      .expect(403);
    expect(res.body.code).toBe('REQUIREMENT_READONLY');
  });

  it('criteria CRUD với position tăng dần; đã APPROVED thì khóa', async () => {
    const fresh = await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements`)
      .set(auth(ownerToken))
      .send({ title: 'Có criteria' })
      .expect(201);
    const c1 = await request(app.getHttpServer())
      .post(`/api/requirements/${fresh.body.id}/criteria`)
      .set(auth(ownerToken))
      .send({ text: 'Điều kiện 1' })
      .expect(201);
    const c2 = await request(app.getHttpServer())
      .post(`/api/requirements/${fresh.body.id}/criteria`)
      .set(auth(ownerToken))
      .send({ text: 'Điều kiện 2' })
      .expect(201);
    expect(c2.body.position).toBe((c1.body.position as number) + 1);
    await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements/${fresh.body.id}/approve`)
      .set(auth(ownerToken))
      .expect(201);
    const locked = await request(app.getHttpServer())
      .post(`/api/requirements/${fresh.body.id}/criteria`)
      .set(auth(ownerToken))
      .send({ text: 'Thêm sau duyệt' })
      .expect(403);
    expect(locked.body.code).toBe('REQUIREMENT_READONLY');
  });

  it('deprecate APPROVED → DEPRECATED', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${projectA}/requirements/${requirementId}/deprecate`)
      .set(auth(ownerToken))
      .expect(201);
    expect(res.body.status).toBe('DEPRECATED');
  });
});
