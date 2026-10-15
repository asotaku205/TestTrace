// Playwright E2E Slice 1: boot API (test DB) + web, chạy full flow trên UI (nguồn: E2E-01).
// Không in secret.
import { defineConfig, devices } from '@playwright/test';
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

const fileVars = { ...loadEnvFile('.env.example'), ...loadEnvFile('.env') };
const get = (key: string): string | undefined => process.env[key] ?? fileVars[key];

function testDatabaseUrl(): string {
  if (get('TEST_DATABASE_URL')) return get('TEST_DATABASE_URL') as string;
  const user = get('TEST_DATABASE_USERNAME') ?? get('DATABASE_USERNAME') ?? 'postgres';
  const password = encodeURIComponent(
    get('TEST_DATABASE_PASSWORD') ?? get('DATABASE_PASSWORD') ?? '',
  );
  const host = get('TEST_DATABASE_HOST') ?? get('DATABASE_HOST') ?? 'localhost';
  const port = get('TEST_DATABASE_PORT') ?? get('DATABASE_PORT') ?? '5432';
  const name = get('TEST_DATABASE_NAME') ?? 'testtrace_test';
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

const apiEnv = {
  ...process.env,
  DATABASE_URL: testDatabaseUrl(),
  JWT_ACCESS_SECRET: get('JWT_ACCESS_SECRET') ?? 'e2e-access',
  JWT_REFRESH_SECRET: get('JWT_REFRESH_SECRET') ?? 'e2e-refresh',
  API_PORT: '3100',
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  use: { baseURL: 'http://localhost:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @testtrace/api exec tsx src/main.ts',
      port: 3100,
      env: apiEnv,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: 'pnpm --filter @testtrace/web exec vite --port 5173 --strictPort',
      port: 5173,
      env: { ...process.env, API_PROXY: 'http://localhost:3100' },
      reuseExistingServer: false,
    },
  ],
});
