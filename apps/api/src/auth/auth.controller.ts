// Controller auth: chỉ validate request rồi gọi use case (nguồn: Q10 + AUTH-01).
// Refresh token lưu ở HttpOnly cookie (chống XSS); access token trả về body.
import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { AccessGuard, AuthenticatedRequest } from './auth.guard.js';
import { authConfig } from '../config.js';

const COOKIE_NAME = 'refreshToken';

function cookieOptions(): Record<string, unknown> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: authConfig.refreshTtlSeconds * 1000,
  };
}

function refreshTokenFrom(req: Request, body: { refreshToken?: unknown }): string {
  const fromCookie = (req.cookies as Record<string, unknown> | undefined)?.[COOKIE_NAME];
  if (typeof fromCookie === 'string' && fromCookie) return fromCookie;
  if (typeof body.refreshToken === 'string' && body.refreshToken) return body.refreshToken;
  return '';
}

@Controller('auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  register(@Body() body: { email?: unknown; password?: unknown; name?: unknown }) {
    return this.auth.register(
      body.email as string,
      body.password as string,
      typeof body.name === 'string' ? body.name : undefined,
    );
  }

  @Post('login')
  async login(
    @Body() body: { email?: unknown; password?: unknown },
    @Res({ passthrough: true }) res: Response,
  ) {
    const pair = await this.auth.login(body.email as string, body.password as string);
    res.cookie(COOKIE_NAME, pair.refreshToken, cookieOptions());
    return { accessToken: pair.accessToken };
  }

  @Post('refresh')
  async refresh(
    @Body() body: { refreshToken?: unknown },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pair = await this.auth.refresh(refreshTokenFrom(req, body));
    res.cookie(COOKIE_NAME, pair.refreshToken, cookieOptions());
    return { accessToken: pair.accessToken };
  }

  @Post('logout')
  async logout(
    @Body() body: { refreshToken?: unknown },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = refreshTokenFrom(req, body);
    if (token) await this.auth.logout(token);
    res.clearCookie(COOKIE_NAME, { path: '/api/auth' });
    return { ok: true };
  }

  @Get('me')
  @UseGuards(AccessGuard)
  me(@Req() req: AuthenticatedRequest) {
    return { id: req.userId };
  }
}
