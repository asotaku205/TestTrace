// JWT HS256 tối giản cho access/refresh token (nguồn: AUTH-01).
// Không dùng lib ngoài; đủ dùng cho Slice 1, hardening ở M20.
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface JwtPayload {
  sub: string;
  type: 'access' | 'refresh';
  jti?: string;
  exp?: number;
  [key: string]: unknown;
}

export interface JwtSigner {
  sign: (payload: Omit<JwtPayload, 'exp'>, opts: { expiresInSeconds: number }) => string;
  verify: (token: string) => JwtPayload;
}

function base64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input: string): Buffer {
  return Buffer.from(input, 'base64url');
}

export function createJwtSigner(secret: string): JwtSigner {
  return {
    sign(payload, opts) {
      const header = base64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
      const body = base64urlEncode(
        JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + opts.expiresInSeconds }),
      );
      const signature = createHmac('sha256', secret)
        .update(`${header}.${body}`)
        .digest('base64url');
      return `${header}.${body}.${signature}`;
    },
    verify(token) {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw Object.assign(new Error('Token không hợp lệ'), { code: 'AUTH_TOKEN_INVALID' });
      }
      const [header, body, signature] = parts;
      const expected = createHmac('sha256', secret).update(`${header}.${body}`).digest();
      let actual: Buffer;
      try {
        actual = base64urlDecode(signature);
      } catch {
        throw Object.assign(new Error('Token không hợp lệ'), { code: 'AUTH_TOKEN_INVALID' });
      }
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        throw Object.assign(new Error('Token không hợp lệ'), { code: 'AUTH_TOKEN_INVALID' });
      }
      const payload = JSON.parse(base64urlDecode(body).toString('utf8')) as JwtPayload;
      if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) {
        throw Object.assign(new Error('Token đã hết hạn'), { code: 'AUTH_TOKEN_EXPIRED' });
      }
      return payload;
    },
  };
}
