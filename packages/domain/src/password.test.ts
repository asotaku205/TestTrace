// Test hash password bằng scrypt (node:crypto, không dependency ngoài) — nguồn: M01 + AUTH-01.
// Seam: hai hàm công khai hashPassword/verifyPassword.
import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hash rồi verify đúng password', async () => {
    const hash = await hashPassword('mat-khau-manh-123');
    expect(hash).not.toContain('mat-khau-manh-123');
    expect(await verifyPassword('mat-khau-manh-123', hash)).toBe(true);
  });

  it('sai password thì verify false', async () => {
    const hash = await hashPassword('dung-pass');
    expect(await verifyPassword('sai-pass', hash)).toBe(false);
  });

  it('cùng password hash hai lần ra salt khác nhau', async () => {
    const a = await hashPassword('giong-nhau');
    const b = await hashPassword('giong-nhau');
    expect(a).not.toBe(b);
  });

  it('hash bị giả mạo thì verify ném lỗi mã ổn định', async () => {
    await expect(verifyPassword('x', 'khong-phai-hash')).rejects.toMatchObject({
      code: 'AUTH_HASH_MALFORMED',
    });
  });
});
