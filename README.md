# TestTrace Intelligence

Web app quản lý kiểm thử với truy vết sống (nguồn: `ke-hoach-do-an-phan-mem-kiem-thu.md`, file này không commit theo `.gitignore`).
Đặc tả Slice 1: `docs/spec/slice-1.md`. Tiến độ ticket: `docs/spec/slice-1-tickets.md`.

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

## Lệnh

| Lệnh                   | Ý nghĩa                                        |
| ---------------------- | ---------------------------------------------- |
| `pnpm env:check`       | Kiểm tra Node, pnpm, PostgreSQL, biến env      |
| `pnpm db:create`       | Tạo database dev + test (idempotent)           |
| `pnpm db:migrate`      | Migrate database dev (`... [name]` để đặt tên) |
| `pnpm db:migrate:test` | Migrate database test                          |
| `pnpm test`            | Chạy test mọi package                          |
| `pnpm typecheck`       | Kiểm tra kiểu toàn repo                        |
| `pnpm lint`            | ESLint toàn repo                               |
| `pnpm format`          | Prettier check toàn repo                       |
