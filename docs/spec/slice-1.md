## Problem Statement

Từ góc nhìn người dùng (BA/Tester dùng TestTrace Intelligence): hiện tại requirement, acceptance criteria, rủi ro và test case nằm rời rạc, không có nguồn gốc rõ ràng để trả lời "requirement nào chưa được kiểm thử, test nào phủ requirement nào, ai đã đổi gì". Nguồn: plan "Slice 1 — Requirement đến test case" và demo cuối slice (tạo project, requirement có risk và acceptance criteria, viết test case có steps, liên kết hai chiều và xem audit).

## Solution

Từ góc nhìn người dùng: trong một project, người tạo project thành Owner, mời thành viên theo vai trò `OWNER`/`MANAGER`/`TESTER`/`VIEWER`; BA/Tester tạo requirement kèm acceptance criteria và chấm `impact`/`likelihood`, duyệt requirement; Tester tạo suite/test case theo bước và liên kết requirement 2 chiều; mọi thao tác quan trọng để lại audit event để mở lại kiểm tra. Nguồn: plan M01, M02, M04, M08 + Q3 (local account + JWT access/refresh-rotation), Q4 (state machine), Q5 (risk/RTM), Q10 (hợp đồng chung), Q11 (trace/audit).

## User Stories

1. As an Owner, I want tạo project, so that nhóm có không gian dữ liệu tách biệt.
2. As an Owner, I want mời thành viên và gán vai trò `OWNER`/`MANAGER`/`TESTER`/`VIEWER`, so that ai được xem/sửa/chạy/duyệt là rõ ràng.
3. As a Manager, I want đổi vai trò và thu hồi quyền có hiệu lực ngay, so that kiểm soát truy cập kịp thời.
4. As a Viewer bị cấm, I want nhận lỗi `403` với mã ổn định, so that hiểu vì sao bị chặn.
5. As a Tester, I want chọn project hiện tại trước khi thao tác, so that không lẫn dữ liệu giữa các project.
6. As a BA, I want tạo requirement ở trạng thái `DRAFT`, so that soạn thảo trước khi duyệt.
7. As a BA, I want viết acceptance criteria có thể kiểm chứng cho requirement, so that test có căn cứ.
8. As a BA, I want chấm `impact` và `likelihood` 1–5, so that `riskScore = impact × likelihood` được tính thay vì cảm tính.
9. As a BA, I want duyệt requirement (`DRAFT → APPROVED`), so that chỉ requirement đã duyệt mới được tính covered.
10. As a BA, I want sửa requirement đã duyệt tạo revision mới và đánh dấu link cần rà soát, so that thay đổi không âm thầm làm sai test.
11. As a BA, I want xem revision cũ của requirement, so that đối chiếu lịch sử.
12. As a BA, I want requirement không có test hiển thị `Uncovered`, so that biết chỗ còn trống.
13. As a Tester, I want tạo suite theo module nghiệp vụ, so that kho test có cấu trúc thay vì file rời rạc.
14. As a Tester, I want viết test case gồm precondition, steps có thứ tự liên tục, expected result, priority, type, tag, so that thực thi được.
15. As a Tester, I want chuyển test sang `READY` chỉ khi có expected result và ít nhất một requirement link hoặc lý do độc lập, so that test sẵn sàng là có căn cứ.
16. As a Tester, I want sửa test `READY` sinh revision mới thay vì ghi đè, so that run cũ vẫn tái lập được.
17. As a Tester, I want clone test case giữ nguyên trace link, so that tái sử dụng không mất nguồn gốc.
18. As a Tester, I want liên kết requirement–test case 2 chiều, so that chọn requirement thấy test và ngược lại.
19. As a Tester, I want tìm kiếm test theo mã, tên, tag, priority, requirement, so that dùng lại được.
20. As a Manager, I want xem nhật ký audit cho thao tác member/requirement/test, so that truy được ai đổi gì khi nào.
21. As a Tester, I want mọi danh sách có phân trang/lọc/sắp xếp và trạng thái rỗng, so that dùng được khi dữ liệu lớn hoặc trống.
22. As a Tester, I want đăng nhập local account và phiên được giữ bằng JWT access + refresh rotation, so that thao tác an toàn mà không cần OAuth ngoài spec.

## Implementation Decisions

Nguồn chung: plan "Hợp đồng chung giữa các module", M01/M02/M04/M08 + Q1, Q2, Q3, Q4, Q5, Q6, Q10, Q11.

- Module trong phạm vi: M01 (tài khoản, project, RBAC), M02 (requirement, criteria, risk, revision), M04 (suite, case, steps, revision, link), M08 (audit event cho Slice 1; evidence file để sang Slice 2).
- Nền tảng: Node.js 22 LTS, pnpm 9.x, PostgreSQL 16.x (nguồn: Q1); layout `apps/web`, `apps/api`, `packages/domain` và các package sau, import alias `@testtrace/*`, TypeScript strict, ESLint + Prettier (nguồn: Q2).
- Auth: local account (email + password hash), JWT access ngắn hạn + refresh token rotation, thu hồi khi đổi vai trò/thu hồi quyền; kiểm tra quyền ở server; project luôn có ít nhất một Owner, không tự hạ quyền Owner cuối; Viewer chỉ đọc; Tester không đổi cấu hình gate/thành viên (nguồn: plan M01 + Q3 và bổ sung JWT của người dùng).
- Requirement: trạng thái `DRAFT`/`APPROVED`/`DEPRECATED`; `riskScore = impact × likelihood`; mã requirement duy nhất trong project, không tái sử dụng; sửa nội dung đã duyệt tạo `RequirementRevision` và tạo review task cho test liên quan (nguồn: plan M02 + Q4, Q5, Q11).
- Test: trạng thái `DRAFT`/`READY`/`RETIRED`; test đã dùng trong run không xóa cứng (ghi nhận cho Slice 2, Slice 1 chỉ chuẩn bị); step có thứ tự liên tục; clone giữ trace link; retired không thêm vào run mới (nguồn: plan M04 + Q4).
- Trace link: liên kết nhiều-nhiều requirement–test case, đọc được cả hai chiều; thay đổi acceptance criteria tạo review task (nguồn: plan M02/M04 + Q11).
- Hợp đồng chung: mọi thực thể thuộc một `Project`, lọc theo `projectId`; ID UUID + mã dễ đọc duy nhất trong project; time lưu UTC, hiển thị theo múi giờ người dùng; thao tác đổi dữ liệu trả lỗi mã ổn định; controller chỉ validate rồi gọi use case, rule nằm ở `packages/domain` (nguồn: Q10).
- Database/env: hai database `testtrace_dev` và `testtrace_test` tách biệt; migration đầu tiên rỗng và tiến được từ schema trước; `.env.example` không bí mật; lệnh `env:check`, `db:create`, `db:migrate`, `db:seed`, `db:reset:test`; seed idempotent cho project `TestTrace Self-Test` tối thiểu (nguồn: Q6).
- API tối thiểu (hợp đồng, chưa ấn định path file): login; CRUD project và members; CRUD requirement, approve, CRUD criteria, cập nhật risk; CRUD suite/case, ready, clone, bulk-action; đọc audit theo khoảng thời gian/thực thể (nguồn: plan M01/M02/M04/M08).
- Không thêm framework/dependency ngoài stack plan (React/Vite/TS/TanStack Query/React Hook Form/NestJS/Prisma/PostgreSQL/Vitest hoặc Jest/Supertest/Playwright/pnpm workspace); không regex giả lập parser; không thực thi mã đầu vào; không sửa migration cũ (nguồn: quy tắc dự án của người dùng).

## Testing Decisions

- Cái gì là test tốt ở Slice 1: chỉ assert hành vi quan sát được ở seam tương ứng (domain invariant, API contract, persistence constraint, luồng E2E), không assert chi tiết cài đặt.
- Seams đã chốt với người dùng (nguồn: xác nhận seams Round to-spec): (1) domain seam cho invariant M02/M04, risk, revision; (2) API seam cho project/requirement/test/link; (3) persistence seam Prisma integration cho isolation `projectId`, unique code, audit append-only; (4) auth seam login + JWT rotation + RBAC matrix; (5) E2E seam Playwright cho luồng tạo project → requirement → test → link 2 chiều → audit.
- Module được test: ma trận quyền; chống truy cập chéo `projectId`; boundary thang 1–5; duy nhất của mã; revision/audit; validation form; reorder steps trong transaction; E2E tạo project, mời người, đổi vai trò, thu hồi quyền; E2E tạo, duyệt, liên kết requirement; E2E tạo suite, duyệt test, xem revision; E2E luồng hoàn chỉnh Slice 1 (nguồn: plan M01/M02/M04/M08 mục Kiểm thử).
- Prior art trong repo: chưa có (repo trống ngoài `AGENTS.md` và `docs/agents/`); test đầu tiên của Slice 1 sẽ thành prior art cho các slice sau.
- Mọi domain rule dùng tdd; luồng quan trọng có E2E; code-review trước merge; diagnosing-bugs khi test fail bất thường (nguồn: quy tắc dự án).

## Out of Scope

- M03/M06/M07 (release/build/run/defect/retest) thuộc Slice 2.
- M09–M13 (code registry, orchestrator, CFG core/viewer, adapter) thuộc Slice 3.
- M05/M14 (Test Design Studio, test generator) thuộc Slice 4.
- M15/M16 (impact radar, RTM sống đầy đủ) thuộc Slice 5; Slice 1 chỉ có link 2 chiều và trạng thái `Uncovered` ở mức requirement, chưa có `Stale`/`At risk`/`Trusted` đầy đủ.
- M17/M18/M19/M20 (quality gate, dashboard/report đầy đủ, AI, i18n, backup/restore, hardening) thuộc Slice 6 hoặc xuyên suốt về sau; Slice 1 chỉ có audit đọc cơ bản.
- OAuth/SSO, Docker, graph database, thực thi mã người dùng.

## Further Notes

- Mọi mục trên đều có nguồn từ plan hoặc Q1–Q12; chưa có gì được đánh dấu đúng/hoàn thành, E2E-01 và review mới là căn cứ.
- Publish lên issue tracker: chưa thực hiện vì máy thiếu `gh` CLI; khi có `gh`, tạo GitHub issue từ file này và gắn nhãn `ready-for-agent` theo `docs/agents/triage-labels.md`. Nhãn `ready-for-agent` hiện chưa được tạo trên tracker.
- Bước tiếp theo theo yêu cầu người dùng: dùng `to-tickets` chia Slice 1 thành ticket nhỏ, mỗi ticket một vertical behavior review được trong một lần đọc, có acceptance criteria rõ ràng.
- Ràng buộc dừng của người dùng vẫn hiệu lực trong mọi ticket: hỏi trước khi thêm dependency ngoài spec, viết implementation trước test, dùng regex giả lập parser, thực thi mã đầu vào, sửa migration cũ.
