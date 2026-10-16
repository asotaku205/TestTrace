// E2E auth: register → login → me → refresh rotation → logout (nguồn: AUTH-01).
// Chạy trên test DB đã migrate. Email ngẫu nhiên để chạy lặp an toàn.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { DomainErrorFilter } from '../src/domain-error.filter.js';
import cookieParser from 'cookie-parser';

const suffix = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const email = `e2e-${suffix}@example.com`;
const password = 'mat-khau-123';

let app: INestApplication;

function cookieValue(res: { headers: Record<string, unknown> }, name: string): string {
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : [raw];
  for (const c of list) {
    const m = /^([^=]+)=([^;]*)/.exec(String(c ?? ''));
    if (m && m[1] === name) return decodeURIComponent(m[2]);
  }
  return '';
}

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.use(cookieParser());
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
    expect(login.body.refreshToken).toBeUndefined();
    const rtCookie = cookieValue(login, 'refreshToken');
    expect(rtCookie).not.toBe('');
    expect(String(login.headers['set-cookie'])).toMatch(/httponly/i);
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

  it('refresh xoay vòng qua cookie: token cũ bị thu hồi', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    const oldRt = cookieValue(login, 'refreshToken');
    expect(oldRt).not.toBe('');
    const rotated = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${oldRt}`)
      .expect(201);
    expect(rotated.body.accessToken).toBeDefined();
    const newRt = cookieValue(rotated, 'refreshToken');
    expect(newRt).not.toBe('');
    expect(newRt).not.toBe(oldRt);
    const reuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${oldRt}`)
      .expect(401);
    expect(reuse.body.code).toBe('AUTH_TOKEN_REVOKED');
  });

  it('logout thu hồi refresh token và xóa cookie', async () => {
    const login = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);
    const rt = cookieValue(login, 'refreshToken');
    const out = await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set('Cookie', `refreshToken=${rt}`)
      .expect(201);
    expect(String(out.headers['set-cookie'] ?? '')).toMatch(/refreshToken=/);
    const reuse = await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${rt}`)
      .expect(401);
    expect(reuse.body.code).toBe('AUTH_TOKEN_REVOKED');
  });

  it('thiếu Bearer token → 401', async () => {
    await request(app.getHttpServer()).get('/api/auth/me').expect(401);
  });
});
