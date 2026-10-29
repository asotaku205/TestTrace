# Video Demo
Bản trình bày 15p:
https://drive.google.com/file/d/1KAbEhqE8aiTOxOCKcyGDijO7dwU_BT5M/view?usp=sharing
Bản 6p Không có tiếng:
https://drive.google.com/file/d/1asr0AFJKI3ui2tZpOjvSrH-SRffLRZqX/view?usp=sharing
# TestTrace Intelligence

Web app quản lý kiểm thử phần mềm với truy vết sống và cổng chất lượng. Dự án đồ án môn Kiểm định và Chất lượng phần mềm, nhóm 2 người, xây dựng theo 6 lát cắt dọc (vertical slice), đặc tả 20 nhóm module (M01-M20).

## Vấn đề giải quyết

Nhiều nhóm quản lý kiểm thử bằng Excel, chat và giấy tờ rời rạc. Hệ quả là 3 thứ: không biết yêu cầu nào đã được test và yêu cầu nào chưa; sửa code xong không biết phải test lại cái gì, chạy thừa hoặc chạy sót; quyết định release theo cảm tính, không có số liệu.

TestTrace gom tất cả vào một nơi: quản lý yêu cầu, viết test case, chạy test, theo dõi defect, phân tích mã nguồn để gợi ý test, ma trận truy vết sống và cổng chất lượng chặn release khi chưa đạt chuẩn.

## Người dùng

4 vai trò: BA viết yêu cầu, tester viết và chạy test case, developer nhận defect về sửa, trưởng nhóm nhìn dashboard và cổng chất lượng để quyết định release. Phân quyền gồm OWNER, MANAGER, TESTER, VIEWER.

## Tính năng chính

- **Dashboard**: 4 số liệu sức khỏe dự án, biểu đồ xu hướng pass, kết quả cổng chất lượng mới nhất, biểu đồ donut truy vết, yêu cầu rủi ro cao, hoạt động gần đây.
- **Requirement**: mã riêng, trạng thái DRAFT/APPROVED, chấm điểm rủi ro bằng impact nhân likelihood (thang 1 tới 5), sửa yêu cầu đã duyệt thì sinh phiên bản mới và tạo review task cho test liên quan, phân trang 20 dòng kèm lọc theo score.
- **Kho test**: tổ chức theo suite (Smoke, Regression), test case có bước và kết quả mong đợi, gắn 2 chiều với requirement, duyệt sang READY mới được đem đi chạy, clone giữ liên kết truy vết, retire thay cho xóa cứng.
- **Release**: khai báo release, build, môi trường, freeze, thêm build và environment.
- **Lượt chạy**: gắn đúng một bộ ba release, build, môi trường; lưu ảnh chụp test case lúc tạo; ghi PASS/FAIL/BLOCKED có bắt buộc actual result và lý do; tạo defect trực tiếp từ kết quả FAIL; đính kèm bằng chứng; hoàn tất thì bản tóm tắt không sửa ngược được.
- **Defect**: luồng trạng thái NEW, TRIAGED, ASSIGNED, IN_PROGRESS, FIXED, RETEST, CLOSED, REJECTED, REOPENED; bắt buộc nhập fixed build; kiểm thử lại trên bản mới, pass thì đóng, fail thì mở lại; lịch sử chuyển trạng thái và đính kèm đầy đủ.
- **Analysis Lab**: dán function cần phân tích, vẽ sơ đồ luồng CFG, xem độ phức tạp, decision, đường đi, zoom, kéo nền, bấm node tự cuộn tới dòng code, lọc exception và loop-back edge, export SVG/JSON, sinh test biên BVA.
- **Duyệt draft**: bản nháp do hệ thống gợi ý, con người luôn duyệt cuối cùng; gợi ý kết quả mong đợi bằng cách giải điều kiện đường đi và chạy thử hàm JS trong sandbox, oracle luôn ở trạng thái NEEDS_REVIEW; duyệt, sửa inputs JSON, từ chối có lý do, chống gợi ý trùng.
- **Code registry**: đăng ký file mã nguồn thật của dự án, version theo hash nội dung, tách unit theo hàm, gắn unit với requirement.
- **Impact**: so sánh 2 version code, cho thấy node thêm, xóa, sửa, delta complexity và danh sách regression đề xuất kèm mã lý do.
- **RTM sống**: trạng thái TRUSTED, STALE, AT_RISK, UNCOVERED tính lại từ dữ liệu mới nhất (kết quả chạy, defect, version code), lọc theo release, trạng thái và risk tối thiểu.
- **Quality gate**: luật viết bằng YAML, kiểm tra cú pháp, khóa version khi publish, evaluate trên đúng một build, kết quả xác định và gắn với bản luật, thiếu dữ liệu thì báo INDETERMINATE chứ không tự cho pass.
- **Báo cáo**: xuất CSV 7 loại (RTM, Execution, Defects, Complexity, Impact, Gate, Audit) dùng cùng truy vấn với dashboard nên số liệu khớp màn hình.
- **Nhật ký**: ghi thêm, không sửa xóa, lọc theo loại thực thể, phân trang.
- **Thành viên**: mời member theo email, đổi vai trò, thu hồi quyền, project luôn giữ ít nhất một OWNER.
- **Đa ngôn ngữ**: giao diện Tiếng Việt và English, đổi ngôn ngữ giữ nguyên trang đang làm việc.

## Điểm nổi bật

1. **Truy vết sống**: requirement đổi, code đổi, kết quả chạy đổi thì ma trận tự cập nhật, biết ngay chỗ nào lỗi thời hay rủi ro, không cần cập nhật tay.
2. **Cổng chất lượng**: release phải qua luật chấm điểm tự động, thiếu dữ liệu thì không tự cho pass, quyết định bằng số liệu.
3. **Sinh test từ mã nguồn**: phân tích sơ đồ luồng đa ngôn ngữ, gợi ý test từ đường đi và từ biên giá trị, nhưng con người luôn duyệt cuối cùng.

## Công nghệ

| Lớp | Công nghệ |
|-----|-----------|
| Monorepo | pnpm 9, TypeScript 5.6, gói dùng chung giữa API, web và thuật toán |
| API | NestJS 11 trên Express, Prisma 6, PostgreSQL 16 |
| Xác thực | JWT tự ký và kiểm tra bằng node:crypto, mật khẩu băm scrypt, refresh token xoay vòng, cookie HttpOnly |
| Web | React 19, Vite 6, Tailwind CSS 4, Recharts, Sonner |
| Tải file | Multer, kiểm tra loại file cho đính kèm bằng chứng |
| Kiểm thử | Vitest, Supertest, Playwright |

## Thuật toán áp dụng

| Thuật toán | Chỗ áp dụng |
|-----------|-------------|
| Dựng CFG từ cây cú pháp | JS/TS qua Babel parser; Python qua cây AST của Python, chạy tiến trình con chỉ đọc, không eval |
| Độ phức tạp cyclomatic | M bằng E trừ N cộng 2P, tính trên graph trung lập, không phụ thuộc ngôn ngữ |
| Liệt kê đường đi | Duyệt theo chiều sâu, đường đơn từ ENTRY tới EXIT, không lặp node, chặn tối đa 200 đường |
| Xếp lớp graph | Duyệt theo chiều rộng từ ENTRY để tính tọa độ hiển thị |
| Sinh test biên (BVA) | 5 điểm: min, max, sát biên dưới, sát biên trên, giá trị đại diện |
| Gợi ý kết quả mong đợi | Giải điều kiện trên đường đi thành input, rồi chạy thử hàm JS trong sandbox node:vm (chỉ giảm rủi ro cho đồ án tự host, không phải sandbox bảo mật tuyệt đối) |
| So sánh 2 version code | Chuẩn hóa điều kiện rồi đối chiếu graph, ghép unit theo ngôn ngữ, tên và chữ ký, phân loại thêm, xóa, sửa, di chuyển |
| Ma trận truy vết sống | Luật suy trạng thái từ tín hiệu mới nhất: kết quả chạy, defect, version mã nguồn |
| Cổng chất lượng | Luật YAML đánh giá trên ảnh chụp dữ liệu của một build, chạy lại cho cùng một kết quả |
| Chấm điểm rủi ro | Score bằng impact nhân likelihood, thang 1 tới 5 |

Mọi gợi ý test đều chạy theo luật xác định, không dùng mô hình ngôn ngữ. Module AI hỗ trợ (M19) đã hoãn lại, nằm ngoài phạm vi bản này.

## Cấu trúc repo

```
apps/
  api/        API NestJS
  web/        Giao diện React + Vite
packages/
  cfg-core/         Graph CFG trung lập, độ phức tạp, đường đi, diff, layout
  domain/           Luật nghiệp vụ: RTM, gate, impact, risk, defect, JWT, mật khẩu
  db/               Prisma client và schema
  language-js-ts/   Adapter JS/TS qua Babel parser
  language-python/  Adapter Python qua cây AST
  test-generation/  Sinh draft: BVA, giải điều kiện đường đi, oracle
  test-fixtures/    Fixture kiểm thử theo hợp đồng chung
docs/
  spec/       Đặc tả 6 lát cắt và ticket
  adr/        Quyết định kiến trúc
  agents/     Quy ước làm việc của agent
```

## Yêu cầu môi trường

- Node.js major >= 22, pnpm 9.x, PostgreSQL >= 16, Python >= 3.10.
- Không dùng Docker.

## Cài đặt và chạy

1. Tạo role/database trong pgAdmin hoặc psql:
   `CREATE DATABASE testtrace_dev; CREATE DATABASE testtrace_test;`
2. `Copy-Item .env.example .env` rồi sửa `DATABASE_PASSWORD` (và user/host nếu khác mặc định). Trên Linux/macOS dùng `cp .env.example .env`.
3. `pnpm install`
4. `pnpm env:check`
5. `pnpm db:create` rồi `pnpm db:migrate` rồi `pnpm db:seed`
6. Chạy app ở 2 terminal: `pnpm --filter @testtrace/api dev` (cổng 3000) và `pnpm --filter @testtrace/web dev` (cổng 5173).

## Lệnh thường dùng

| Lệnh | Ý nghĩa |
|------|---------|
| `pnpm env:check` | Kiểm tra Node, pnpm, PostgreSQL, biến env |
| `pnpm db:create` | Tạo database dev + test (idempotent) |
| `pnpm db:migrate` | Migrate database dev |
| `pnpm db:migrate:test` | Migrate database test |
| `pnpm db:seed` | Seed dữ liệu demo (idempotent, chạy 2 lần vẫn ok) |
| `pnpm db:backup <file>` | Backup database dev ra file |
| `pnpm db:restore <file>` | Restore database dev từ file |
| `pnpm test` | Chạy test mọi package |
| `pnpm e2e` | Chạy kịch bản đầu cuối Playwright (cần cài Chromium 1 lần) |
| `pnpm typecheck` | Kiểm tra kiểu toàn repo |
| `pnpm lint` | ESLint toàn repo |
| `pnpm format` | Prettier check toàn repo |


## Phạm vi và hướng mở rộng

Ngoài phạm vi bản này: module AI hỗ trợ (M19), adapter Java và C/C++, phân vùng tương đương cho BVA, lịch sử và xu hướng của Quality Gate. Hướng mở rộng: hoàn thiện các adapter còn lại, bổ sung AI gợi ý test có kiểm soát, và lịch sử đánh giá gate theo thời gian.
