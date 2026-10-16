// Backup/restore database bằng pg_dump/pg_restore (nguồn: OPS-01).
// Dùng pg bin trong PATH hoặc PG_BIN. Không in secret.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const [command, file] = process.argv.slice(2);
if ((command !== 'backup' && command !== 'restore') || !file) {
  console.error('Dùng: node scripts/db-backup.mjs <backup|restore> <file>');
  process.exit(1);
}
if (!/^[\w\-./\\:]+$/.test(file) || /[&|;$`()<>]/.test(file)) {
  console.error('Tên file không hợp lệ');
  process.exit(1);
}

function loadEnv() {
  const vars = {};
  for (const path of ['.env.example', '.env']) {
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
      if (m) vars[m[1]] = m[2];
    }
  }
  return { ...vars, ...process.env };
}

const env = loadEnv();
const host = env.DATABASE_HOST ?? 'localhost';
const port = env.DATABASE_PORT ?? '5432';
const user = env.DATABASE_USERNAME ?? 'postgres';
const password = env.DATABASE_PASSWORD ?? '';
const name = env.DATABASE_NAME ?? 'testtrace_dev';

const pgEnv = { ...process.env, PGPASSWORD: password };

function resolvePgBin(tool) {
  if (process.env.PG_BIN) return `"${process.env.PG_BIN}/${tool}"`;
  const candidates = [
    'C:\\Program Files\\PostgreSQL\\18\\bin',
    'C:\\Program Files\\PostgreSQL\\17\\bin',
    'C:\\Program Files\\PostgreSQL\\16\\bin',
  ];
  for (const dir of candidates) {
    try {
      if (existsSync(`${dir}/${tool}.exe`)) return `"${dir}/${tool}"`;
    } catch {
      continue;
    }
  }
  return tool;
}
if (command === 'backup') {
  const result = spawnSync(
    `${resolvePgBin('pg_dump')} -h ${host} -p ${port} -U ${user} -F c -f ${file} ${name}`,
    {
      stdio: 'inherit',
      env: pgEnv,
      shell: true,
    },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`backup ok: ${file}`);
} else {
  const result = spawnSync(
    `${resolvePgBin('pg_restore')} -h ${host} -p ${port} -U ${user} -d ${name} --clean --if-exists ${file}`,
    { stdio: 'inherit', env: pgEnv, shell: true },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
  console.log(`restore ok: ${file}`);
}
