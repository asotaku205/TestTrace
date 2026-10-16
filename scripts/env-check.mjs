// env:check — kiểm tra Node, pnpm, PostgreSQL và biến môi trường (nguồn: plan M20 + Q6, ADR-0001).
// Chạy: pnpm env:check. Thoát != 0 khi thiếu điều kiện bắt buộc.
import { execSync } from 'node:child_process';
import { connect } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';

const failures = [];
const warnings = [];

function majorOf(version) {
  const m = version.match(/(\d+)\.(\d+)\.(\d+)/);
  return m ? Number(m[1]) : null;
}

// 1. Node >= 22 (ADR-0001: chấp nhận major mới hơn 22).
const nodeMajor = majorOf(process.version);
if (nodeMajor === null || nodeMajor < 22) {
  failures.push(`Node ${process.version}: yêu cầu Node major >= 22 (ADR-0001).`);
} else {
  console.log(`ok node ${process.version}`);
}

// 2. pnpm >= 9.
try {
  const out = execSync('pnpm --version', { encoding: 'utf8' }).trim();
  const pnpmMajor = majorOf(out);
  if (pnpmMajor === null || pnpmMajor < 9) {
    failures.push(`pnpm ${out}: yêu cầu pnpm major >= 9.`);
  } else {
    console.log(`ok pnpm ${out}`);
  }
} catch {
  failures.push('Thiếu pnpm: cài pnpm@9 (npm install -g pnpm@9).');
}

// 3. PostgreSQL TCP reachable (không cần psql CLI; dùng kiểm tra TCP).
// Ưu tiên DATABASE_URL nếu có; ngược lại dùng biến rời HOST/PORT/USERNAME/PASSWORD/NAME.
function loadDotEnv(path) {
  const vars = {};
  if (!existsSync(path)) return vars;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m) vars[m[1]] = m[2];
  }
  return vars;
}
const fileVars = { ...loadDotEnv('.env.example'), ...loadDotEnv('.env') };
const envOf = (key) => process.env[key] ?? fileVars[key];
const databaseUrl =
  envOf('DATABASE_URL') ??
  `postgresql://${envOf('DATABASE_USERNAME') ?? 'postgres'}:${envOf('DATABASE_PASSWORD') ?? ''}@${envOf('DATABASE_HOST') ?? 'localhost'}:${envOf('DATABASE_PORT') ?? 5432}/${envOf('DATABASE_NAME') ?? 'testtrace_dev'}`;

function parseHostPort(url) {
  const m = url.match(/^postgresql:\/\/[^@]+@([^/:]+)(?::(\d+))?\//);
  return { host: m?.[1] ?? 'localhost', port: Number(m?.[2] ?? 5432) };
}

await new Promise((resolve) => {
  const { host, port } = parseHostPort(databaseUrl);
  const socket = connect({ host, port }, () => {
    console.log(`ok postgres ${host}:${port} (TCP)`);
    socket.end();
    resolve();
  });
  socket.setTimeout(3000);
  socket.on('timeout', () => {
    failures.push(
      `Không nối được PostgreSQL ${host}:${port} (timeout): kiểm tra server và DATABASE_URL.`,
    );
    socket.destroy();
    resolve();
  });
  socket.on('error', (err) => {
    failures.push(
      `Không nối được PostgreSQL ${host}:${port} (${err.message}): kiểm tra server và DATABASE_URL.`,
    );
    resolve();
  });
});

// 4. Biến môi trường bắt buộc phải khai báo (trong .env hoặc môi trường thật).
// Chấp nhận 1 trong 2 dạng: DATABASE_URL/TEST_DATABASE_URL, hoặc bộ biến rời.
const hasUrlForm = Boolean(envOf('DATABASE_URL') && envOf('TEST_DATABASE_URL'));
const hasPartsForm = Boolean(
  envOf('DATABASE_USERNAME') && envOf('DATABASE_PASSWORD') && envOf('DATABASE_NAME'),
);
if (!hasUrlForm && !hasPartsForm) {
  warnings.push(
    'Thiếu cấu hình database: khai báo DATABASE_URL + TEST_DATABASE_URL, hoặc bộ DATABASE_USERNAME/PASSWORD/NAME trong .env (xem .env.example).',
  );
}
for (const key of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!(process.env[key] ?? fileVars[key])) {
    warnings.push(`Thiếu ${key}: khai báo trong .env (xem .env.example).`);
  }
}
if (!existsSync('.env')) {
  warnings.push('Chưa có .env: copy từ .env.example để chạy local.');
}

const printed = new Set();
for (const w of warnings) {
  console.log(`warn ${w}`);
  printed.add(w);
}

// 5. Python >= 3.10 cho adapter Python (Slice 4+; warn-only để không chặn Slice 1–3).
try {
  const out = execSync('python --version', { encoding: 'utf8' }).trim();
  const m = out.match(/Python (\d+)\.(\d+)/);
  if (!m || Number(m[1]) < 3 || (Number(m[1]) === 3 && Number(m[2]) < 10)) {
    warnings.push(`Python ${out}: khuyến nghị Python >= 3.10 cho adapter Python (Slice 4+).`);
  } else {
    console.log(`ok ${out.toLowerCase()} (adapter Python)`);
  }
} catch {
  warnings.push('Thiếu Python: cần Python >= 3.10 cho adapter Python (Slice 4+).');
}

for (const w of warnings.slice(0)) {
  if (!printed.has(w)) {
    console.log(`warn ${w}`);
    printed.add(w);
  }
}
if (failures.length > 0) {
  for (const f of failures) console.error(`fail ${f}`);
  process.exit(1);
}
console.log('env:check passed');
