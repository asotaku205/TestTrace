# TestTrace Intelligence

Web app quản lý kiểm thử với truy vết sống 

## Yêu cầu

- Node.js major >= 22, pnpm 9.x, PostgreSQL server >= 16 (đã kiểm chứng trên Node 26 + PG 18, xem `docs/adr/0001-toolchain-versions.md`).
- Không dùng Docker.

## Cài đặt (Windows, PostgreSQL cài trực tiếp)

1. Tạo role/database trong pgAdmin hoặc psql:
   `CREATE DATABASE testtrace_dev; CREATE DATABASE testtrace_test;`
2. `Copy-Item .env.example .env` rồi sửa `DATABASE_PASSWORD` (và user/host nếu khác mặc định).
3. `pnpm install`
4. `pnpm env:check`
5. `pnpm test`
6. E2E UI (cần test DB đã migrate): `pnpm exec playwright install chromium`, rồi `pnpm e2e`

## Rehearsal máy sạch (Mốc 6)

1. Cài Node.js major >= 22, pnpm 9, PostgreSQL >= 16, Python >= 3.10 (xem `docs/adr/0001-toolchain-versions.md`).
2. `Copy-Item .env.example .env` rồi điền `DATABASE_PASSWORD` thật.
3. `pnpm install` → `pnpm env:check` (phải passed).
4. `pnpm db:create` → `pnpm db:migrate` → `pnpm db:migrate:test` → `pnpm db:seed` (chạy 2 lần vẫn ok).
5. `pnpm test` xanh; `pnpm e2e` xanh (cài Chromium 1 lần).
6. Backup/restore drill: `pnpm db:backup <file>` rồi `pnpm db:restore <file>` (cần pg_dump trong PATH hoặc `PG_BIN`).
7. Chạy app: 2 terminal `pnpm --filter @testtrace/api dev` (cổng 3000) và `pnpm --filter @testtrace/web dev` (cổng 5173).

## Lệnh

| Lệnh                               | Ý nghĩa                                                 |
| ---------------------------------- | ------------------------------------------------------- |
| `pnpm env:check`                   | Kiểm tra Node, pnpm, PostgreSQL, biến env               |
| `pnpm db:create`                   | Tạo database dev + test (idempotent)                    |
| `pnpm db:migrate`                  | Migrate database dev (`... [name]` để đặt tên)          |
| `pnpm db:migrate:test`             | Migrate database test                                   |
| `pnpm db:seed`                     | Seed `TestTrace Self-Test` (idempotent)                 |
| `pnpm db:backup <file>`            | Backup database dev ra file                             |
| `pnpm db:restore <file>`           | Restore database dev từ file                            |
| `pnpm test`                        | Chạy test mọi package                                   |
| `pnpm --filter @testtrace/api dev` | Chạy API ở `http://localhost:3000`                      |
| `pnpm --filter @testtrace/web dev` | Chạy UI ở `http://localhost:5173` (proxy `/api` về API) |
| `pnpm typecheck`                   | Kiểm tra kiểu toàn repo                                 |
| `pnpm lint`                        | ESLint toàn repo                                        |
| `pnpm format`                      | Prettier check toàn repo                                |
