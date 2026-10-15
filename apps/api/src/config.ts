// Cấu hình auth từ env, không log secret (nguồn: AUTH-01).
function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Thiếu biến môi trường ${key} (xem .env.example)`);
  return value;
}

export const authConfig = {
  accessSecret: () => required('JWT_ACCESS_SECRET'),
  refreshSecret: () => required('JWT_REFRESH_SECRET'),
  accessTtlSeconds: 15 * 60,
  refreshTtlSeconds: 7 * 24 * 60 * 60,
  port: Number(process.env.API_PORT ?? 3000),
};
