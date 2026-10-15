// Test dựng URL database từ biến rời (nguồn: DB-01).
// Không bao giờ in password ra log.
import { describe, expect, it } from 'vitest';
import { buildDatabaseUrl, buildTestDatabaseUrl } from './database-url.js';

describe('buildDatabaseUrl', () => {
  it('ưu tiên DATABASE_URL khi có', () => {
    const url = buildDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@h:5432/d' });
    expect(url).toBe('postgresql://u:p@h:5432/d');
  });

  it('dựng từ biến rời với giá trị mặc định hợp lý', () => {
    const url = buildDatabaseUrl({ DATABASE_USERNAME: 'postgres', DATABASE_PASSWORD: 'pw' });
    expect(url).toBe('postgresql://postgres:pw@localhost:5432/testtrace_dev');
  });

  it('encode ký tự đặc biệt trong password', () => {
    const url = buildDatabaseUrl({ DATABASE_USERNAME: 'postgres', DATABASE_PASSWORD: 'p@ss:word' });
    expect(url).toBe('postgresql://postgres:p%40ss%3Aword@localhost:5432/testtrace_dev');
  });
});

describe('buildTestDatabaseUrl', () => {
  it('ưu tiên TEST_DATABASE_URL khi có', () => {
    const url = buildTestDatabaseUrl({ TEST_DATABASE_URL: 'postgresql://u:p@h:5432/t' });
    expect(url).toBe('postgresql://u:p@h:5432/t');
  });

  it('dùng riêng biến TEST_*, rớt về DATABASE_* khi thiếu, tên mặc định testtrace_test', () => {
    const url = buildTestDatabaseUrl({
      DATABASE_HOST: 'db.local',
      DATABASE_USERNAME: 'postgres',
      DATABASE_PASSWORD: 'pw',
      TEST_DATABASE_NAME: 'my_test',
    });
    expect(url).toBe('postgresql://postgres:pw@db.local:5432/my_test');
  });
});
