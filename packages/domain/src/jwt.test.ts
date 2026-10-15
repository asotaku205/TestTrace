// Test JWT HS256 tự ký (node:crypto, không dependency ngoài) — nguồn: AUTH-01.
// Seam: createJwtSigner(secret).sign / .verify. Bắt sai chữ ký, hết hạn, sai secret;
// không bắt rotation (việc của service + RefreshToken ở API seam).
import { describe, expect, it } from 'vitest';
import { createJwtSigner } from './jwt.js';

const signer = createJwtSigner('test-secret-khong-dung-o-prod');

describe('jwt', () => {
  it('sign rồi verify giữ nguyên payload', () => {
    const token = signer.sign({ sub: 'user-1', type: 'access' }, { expiresInSeconds: 900 });
    const payload = signer.verify(token);
    expect(payload.sub).toBe('user-1');
    expect(payload.type).toBe('access');
  });

  it('token bị sửa thì verify ném AUTH_TOKEN_INVALID', () => {
    const token = signer.sign({ sub: 'user-1', type: 'access' }, { expiresInSeconds: 900 });
    const tampered = token.slice(0, -2) + 'xx';
    expect(() => signer.verify(tampered)).toThrowError(
      expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }),
    );
  });

  it('token hết hạn thì verify ném AUTH_TOKEN_EXPIRED', () => {
    const token = signer.sign({ sub: 'user-1', type: 'access' }, { expiresInSeconds: -10 });
    expect(() => signer.verify(token)).toThrowError(
      expect.objectContaining({ code: 'AUTH_TOKEN_EXPIRED' }),
    );
  });

  it('secret khác thì verify ném AUTH_TOKEN_INVALID', () => {
    const other = createJwtSigner('secret-khac');
    const token = other.sign({ sub: 'user-1', type: 'access' }, { expiresInSeconds: 900 });
    expect(() => signer.verify(token)).toThrowError(
      expect.objectContaining({ code: 'AUTH_TOKEN_INVALID' }),
    );
  });
});
