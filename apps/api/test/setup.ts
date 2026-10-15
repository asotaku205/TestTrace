// Setup e2e: dựng TEST_DATABASE_URL từ biến rời trước khi import Prisma client.
// Không in secret.
import 'reflect-metadata';
import { existsSync, readFileSync } from 'node:fs';

function loadEnvFile(path: string): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

const fileVars = {
  ...loadEnvFile('../../.env.example'),
  ...loadEnvFile('../../.env'),
};
// Nạp biến từ file vào process.env khi thiếu (app đọc config qua process.env).
for (const [key, value] of Object.entries(fileVars)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
const get = (key: string): string | undefined => process.env[key] ?? fileVars[key];

if (!get('TEST_DATABASE_URL')) {
  const user = get('TEST_DATABASE_USERNAME') ?? get('DATABASE_USERNAME') ?? 'postgres';
  const password = encodeURIComponent(
    get('TEST_DATABASE_PASSWORD') ?? get('DATABASE_PASSWORD') ?? '',
  );
  const host = get('TEST_DATABASE_HOST') ?? get('DATABASE_HOST') ?? 'localhost';
  const port = get('TEST_DATABASE_PORT') ?? get('DATABASE_PORT') ?? '5432';
  const name = get('TEST_DATABASE_NAME') ?? 'testtrace_test';
  process.env.DATABASE_URL = `postgresql://${user}:${password}@${host}:${port}/${name}`;
} else {
  process.env.DATABASE_URL = get('TEST_DATABASE_URL');
}
