// Hash password bằng scrypt (nguồn: M01 local account + AUTH-01).
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString('hex')}`;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') {
    throw Object.assign(new Error('Định dạng hash không hợp lệ'), {
      code: 'AUTH_HASH_MALFORMED',
    });
  }
  const derived = (await scrypt(password, parts[1], 64)) as Buffer;
  return derived.toString('hex') === parts[2];
}
