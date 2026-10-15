// Controller auth: chỉ validate request rồi gọi use case (nguồn: Q10 + AUTH-01).
import { Body, Controller, Get, Inject, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service.js';
import { AccessGuard, AuthenticatedRequest } from './auth.guard.js';

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
  login(@Body() body: { email?: unknown; password?: unknown }) {
    return this.auth.login(body.email as string, body.password as string);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken?: unknown }) {
    return this.auth.refresh(body.refreshToken as string);
  }

  @Post('logout')
  logout(@Body() body: { refreshToken?: unknown }) {
    return this.auth.logout(body.refreshToken as string);
  }

  @Get('me')
  @UseGuards(AccessGuard)
  me(@Req() req: AuthenticatedRequest) {
    return { id: req.userId };
  }
}
