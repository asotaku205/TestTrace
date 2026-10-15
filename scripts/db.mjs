// Lệnh database thống nhất (nguồn: plan Stack kỹ thuật + Q6).
// Dựng DATABASE_URL/TEST_DATABASE_URL từ biến rời rồi gọi prisma/pg. Không in secret.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';

const [command] = process.argv.slice(2);

function loadDotEnv(path) {
  const vars = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}

function readEnv() {
  const fileVars = { ...loadDotEnv('.env.example'), ...loadDotEnv('.env') };
  return { ...fileVars, ...process.env };
}

function buildUrl(env, prefix) {
  // prefix '' (dev) hoặc 'TEST_'. Chỉ đọc đúng tiền tố để tránh đụng biến hệ thống
  // (ví dụ %USERNAME% trên Windows).
  const directKey = prefix === 'TEST_' ? 'TEST_DATABASE_URL' : 'DATABASE_URL';
  if (env[directKey]) return env[directKey];
  const get = (suffix) => env[`${prefix}DATABASE_${suffix}`] || env[`DATABASE_${suffix}`];
  const host = get('HOST') || 'localhost';
  const port = get('PORT') || '5432';
  const user = get('USERNAME') || 'postgres';
  const password = encodeURIComponent(get('PASSWORD') || '');
  const name = get('NAME') || (prefix === 'TEST_' ? 'testtrace_test' : 'testtrace_dev');
  return `postgresql://${user}:${password}@${host}:${port}/${name}`;
}

function maintenanceUrl(env) {
  // Nối vào database postgres mặc định để CREATE DATABASE.
  const base = buildUrl(env, '');
  return base.replace(/\/[^/]*$/, '/postgres');
}

async function createDatabases() {
  const env = readEnv();
  const admin = new pg.Client({ connectionString: maintenanceUrl(env) });
  await admin.connect();
  for (const prefix of ['', 'TEST_']) {
    const url = buildUrl(env, prefix);
    const name = url.split('/').pop();
    await admin.query(`CREATE DATABASE "${name}"`);
    console.log(`ok database ${name} (tạo mới)`);
  }
  await admin.end();
}

function runPrisma(args, databaseUrl) {
  for (const arg of args) {
    if (!/^[A-Za-z0-9_.-]+$/.test(arg)) {
      console.error(`fail: đối số prisma không hợp lệ: ${arg}`);
      process.exit(1);
    }
  }
  // Dùng chuỗi lệnh đơn với shell để tương thích .cmd trên Windows;
  // mọi đối số đã qua whitelist ở trên, secret chỉ đi qua env.
  const result = spawnSync(`pnpm exec prisma ${args.join(' ')}`, {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const env = readEnv();
switch (command) {
  case 'create':
    await createDatabases().catch((err) => {
      if (err?.code === '42P04') {
        console.log('ok databases đã tồn tại, bỏ qua');
      } else {
        console.error(`fail db:create (${err.message})`);
        process.exit(1);
      }
    });
    break;
  case 'migrate': {
    const rest = process.argv.slice(3);
    const flagIndex = rest.findIndex((a) => a === '--name' || a === '-n');
    const name = flagIndex >= 0 ? (rest[flagIndex + 1] ?? 'init') : (rest[0] ?? 'init');
    runPrisma(['migrate', 'dev', '--name', name], buildUrl(env, ''));
    break;
  }
  case 'migrate:test':
    runPrisma(['migrate', 'deploy'], buildUrl(env, 'TEST_'));
    break;
  default:
    console.error('Dùng: node scripts/db.mjs <create|migrate [name]|migrate:test>');
    process.exit(1);
}
