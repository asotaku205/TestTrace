// Use case auth: register/login/refresh/logout + audit append (nguồn: M01 + AUTH-01).
// Controller chỉ validate rồi gọi service; rule nằm ở @testtrace/domain.
import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { createAuditEvent, createJwtSigner, hashPassword, verifyPassword } from '@testtrace/domain';
import { PRISMA } from '../prisma.module.js';
import { authConfig } from '../config.js';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

function validEmail(email: unknown): email is string {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

@Injectable()
export class AuthService {
  constructor(@Inject(PRISMA) private readonly db: PrismaClient) {}

  private async appendAudit(input: {
    actorId: string;
    entityType: string;
    entityId: string;
    action: string;
  }): Promise<void> {
    const event = createAuditEvent({ ...input, projectId: null });
    await this.db.auditEvent.create({
      data: {
        projectId: event.projectId,
        actorId: event.actorId,
        entityType: event.entityType,
        entityId: event.entityId,
        action: event.action,
        createdAt: new Date(event.at),
      },
    });
  }

  private sha256(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private issuePair(userId: string): { pair: TokenPair; refreshJti: string } {
    const accessSigner = createJwtSigner(authConfig.accessSecret());
    const refreshSigner = createJwtSigner(authConfig.refreshSecret());
    const refreshJti = randomUUID();
    return {
      pair: {
        accessToken: accessSigner.sign(
          { sub: userId, type: 'access' },
          { expiresInSeconds: authConfig.accessTtlSeconds },
        ),
        refreshToken: refreshSigner.sign(
          { sub: userId, type: 'refresh', jti: refreshJti },
          { expiresInSeconds: authConfig.refreshTtlSeconds },
        ),
      },
      refreshJti,
    };
  }

  async register(email: string, password: string, name?: string): Promise<{ id: string }> {
    if (!validEmail(email)) fail('VALIDATION_ERROR', 'Email không hợp lệ');
    if (typeof password !== 'string' || password.length < 8)
      fail('VALIDATION_ERROR', 'Password tối thiểu 8 ký tự');
    const exists = await this.db.user.findUnique({ where: { email } });
    if (exists) fail('AUTH_EMAIL_TAKEN', 'Email đã được dùng');
    const user = await this.db.user.create({
      data: { email, passwordHash: await hashPassword(password), name },
    });
    await this.appendAudit({
      actorId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'user.registered',
    });
    return { id: user.id };
  }

  async login(email: string, password: string): Promise<TokenPair> {
    const user = await this.db.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash)))
      fail('AUTH_INVALID_CREDENTIALS', 'Sai email hoặc password');
    const { pair } = this.issuePair(user.id);
    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.sha256(pair.refreshToken),
        expiresAt: new Date(Date.now() + authConfig.refreshTtlSeconds * 1000),
      },
    });
    await this.appendAudit({
      actorId: user.id,
      entityType: 'session',
      entityId: user.id,
      action: 'session.created',
    });
    return pair;
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    let payload: { sub: string; type: string; jti?: string };
    try {
      payload = createJwtSigner(authConfig.refreshSecret()).verify(refreshToken) as typeof payload;
    } catch (err) {
      throw err;
    }
    if (payload.type !== 'refresh' || !payload.jti)
      fail('AUTH_TOKEN_INVALID', 'Refresh token không hợp lệ');
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash: this.sha256(refreshToken) },
    });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date())
      fail('AUTH_TOKEN_REVOKED', 'Refresh token đã bị thu hồi hoặc hết hạn');
    const { pair } = this.issuePair(payload.sub);
    await this.db.$transaction([
      this.db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      this.db.refreshToken.create({
        data: {
          userId: payload.sub,
          tokenHash: this.sha256(pair.refreshToken),
          expiresAt: new Date(Date.now() + authConfig.refreshTtlSeconds * 1000),
        },
      }),
    ]);
    await this.appendAudit({
      actorId: payload.sub,
      entityType: 'session',
      entityId: payload.sub,
      action: 'session.rotated',
    });
    return pair;
  }

  async logout(refreshToken: string): Promise<void> {
    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash: this.sha256(refreshToken) },
    });
    if (!stored) fail('AUTH_TOKEN_INVALID', 'Refresh token không hợp lệ');
    if (!stored.revokedAt) {
      await this.db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });
    }
    await this.appendAudit({
      actorId: stored.userId,
      entityType: 'session',
      entityId: stored.userId,
      action: 'session.revoked',
    });
  }
}
