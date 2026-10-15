// Dựng URL database từ biến rời, ưu tiên DATABASE_URL (nguồn: DB-01).
export function buildDatabaseUrl(env: Record<string, string | undefined>): string {
  if (env.DATABASE_URL) return env.DATABASE_URL;
  const user = env.DATABASE_USERNAME ?? 'postgres';
  const password = encodeURIComponent(env.DATABASE_PASSWORD ?? '');
  const host = env.DATABASE_HOST ?? 'localhost';
  const port = env.DATABASE_PORT ?? '5432';
  const name = env.DATABASE_NAME ?? 'testtrace_dev';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

export function buildTestDatabaseUrl(env: Record<string, string | undefined>): string {
  if (env.TEST_DATABASE_URL) return env.TEST_DATABASE_URL;
  const user = env.TEST_DATABASE_USERNAME ?? env.DATABASE_USERNAME ?? 'postgres';
  const password = encodeURIComponent(env.TEST_DATABASE_PASSWORD ?? env.DATABASE_PASSWORD ?? '');
  const host = env.TEST_DATABASE_HOST ?? env.DATABASE_HOST ?? 'localhost';
  const port = env.TEST_DATABASE_PORT ?? env.DATABASE_PORT ?? '5432';
  const name = env.TEST_DATABASE_NAME ?? 'testtrace_test';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}
