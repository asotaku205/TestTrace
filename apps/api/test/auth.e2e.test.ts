// E2E auth: register → login → me → refresh rotation → logout (nguồn: AUTH-01).
// Chạy trên test DB đã migrate. Email ngẫu nhiên để chạy lặp an toàn.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e-${suffix}@example.com`;
const password = 'mat-khau-123';

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new DomainErrorFilter());
  await app.init();
});

afterAll(async () => {
  await app.close();
});

describe('auth e2e', () => {
  it('register → login → me', async () => {
    await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    expect(login.body.accessToken).toBeDefined();
    expect(login.body.refreshToken).toBeDefined();
    const me = await request(app.getHttpServer())
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body.id).toBeDefined();
  });

  it('register trùng email → 409 AUTH_EMAIL_TAKEN', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email, password })
      .expect(409);
    expect(res.body.code).toBe('AUTH_EMAIL_TAKEN');
  });

  it('sai password → 401 AUTH_INVALID_CREDENTIALS', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'sai-pass-456' })
      .expect(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  it('refresh xoay vòng: token cũ bị thu hồi', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    expect(rotated.body.refreshToken).not.toBe(login.body.refreshToken);
    const reuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    expect(reuse.body.code).toBe('AUTH_TOKEN_REVOKED');
  });

  it('logout thu hồi refresh token', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .send({ refreshToken: login.body.refreshToken })
      .expect(201);
    const reuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
    expect(reuse.body.code).toBe('AUTH_TOKEN_REVOKED');
  });

  it('thiếu Bearer token → 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });
});
