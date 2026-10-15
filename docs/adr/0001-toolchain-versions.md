# ADR-0001: Giữ Node 26 và PostgreSQL 18 thay vì baseline Q1

Ngày: 2026-10-15. Nguồn: Q1 (baseline Node 22 LTS + pnpm 9 + PG 16) và kết quả kiểm tra môi trường.

## Bối cảnh

Q1 chốt baseline Node 22 LTS, pnpm 9.x, PostgreSQL 16.x, mọi lệch version phải qua ADR riêng.
Máy phát triển hiện có: Node v26.0.0 (bản duy nhất, `C:\Program Files\nodejs`), pnpm 9.15.9,
PostgreSQL server 18 đang chạy (`postgresql-x64-18`), pgAdmin làm client. Không có version manager,
không cài thêm được qua `winget` từ môi trường hiện tại.

## Quyết định

- Giữ Node v26.0.0, không cài Node 22.
- Dùng PostgreSQL 18 đang chạy, không cài thêm PG 16.
- pnpm giữ 9.15.9, đúng baseline.

## Lý do

- Node 26 và PG 18 đã có sẵn và chạy ổn định; cài song song thêm Node 22 / PG 16 tốn công,
  PG song song còn cần port riêng và dễ lẫn database.
- Stack plan (NestJS, Prisma, Vite, Vitest, Playwright) tương thích PostgreSQL 18 qua driver chung;
  không dùng tính năng nào đặc thù PG 16.
- Rủi ro còn lại (một dependency chưa hỗ trợ Node 26) được khóa bằng `env:check` và full test suite;
  nếu toolchain gãy sẽ quay lại quyết định này.

## Hệ quả

- `env:check` chấp nhận Node major >= 22 (không khóa cứng 22) và PostgreSQL server >= 16.
- Mọi lệnh tài liệu hóa trong README ghi "đã kiểm chứng trên Node 26 + PG 18".
- Nếu phát hiện không tương thích, ADR này được thay bằng ADR mới (không sửa ngược lịch sử).
