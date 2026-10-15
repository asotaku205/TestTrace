// Guard access token cho route cần đăng nhập (nguồn: AUTH-01; RBAC ở AUTH-02).
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { createJwtSigner } from '@testtrace/domain';
import { authConfig } from '../config.js';

export interface AuthenticatedRequest {
  userId: string;
}

@Injectable()
export class AccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest() as {
      headers: Record<string, string | undefined>;
      userId?: string;
    };
    const header = req.headers['authorization'];
    if (!header?.startsWith('Bearer ')) {
      throw Object.assign(new Error('Thiếu access token'), { code: 'AUTH_TOKEN_INVALID' });
    }
    const payload = createJwtSigner(authConfig.accessSecret()).verify(header.slice(7));
    if (payload.type !== 'access') {
      throw Object.assign(new Error('Token không phải access token'), {
        code: 'AUTH_TOKEN_INVALID',
      });
    }
    req.userId = payload.sub;
    return true;
  }
}
