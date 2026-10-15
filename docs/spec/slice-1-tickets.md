# Slice 1 tickets (markdown-tracked — không publish GitHub vội)

**Tiến độ:** tick khi ticket xong (code + test xanh + review).

- [x] 1. PLAT-01 — Monorepo + env:check + lint + audit event contract
- [x] 2. DB-01 — Schema project/member + dev/test DB
- [x] 3. AUTH-01 — Local login + JWT rotation
- [x] 4. AUTH-02 — RBAC matrix + 403 + member audit
- [x] 5. REQ-01 — Requirement CRUD + approve lifecycle
- [ ] 6. REQ-02 — Risk scoring + revision + review task
- [ ] 7. TEST-01 — Suite/case/steps + READY/clone/search
- [ ] 8. TRACE-01 — Link requirement–test 2 chiều + stale marking
- [ ] 9. AUDIT-01 — Audit read API
- [ ] 10. E2E-01 — Playwright full flow Slice 1

**Dogfooding:** khi E2E-01 xanh, chuyển quản lý ticket của đồ án sang chính TestTrace (project `TestTrace Self-Test`).

Nguồn: `docs/spec/slice-1.md` + breakdown duyệt (10 ticket, mỗi ticket gồm API + UI tối thiểu của chính nó).
Publish: tạo GitHub issue theo thứ tự dependency (blocker trước), gắn nhãn `ready-for-agent`, dùng native sub-issue/blocking của tracker nếu có.

Quy tắc chung mọi ticket: tdd cho domain rule; code-review trước merge; diagnosing-bugs khi test fail bất thường; dừng và hỏi trước khi thêm dependency ngoài spec, viết implementation trước test, dùng regex giả lập parser, thực thi mã đầu vào, sửa migration cũ. Không tự đánh dấu đúng/hoàn thành.

---

## 1. PLAT-01 — Monorepo + env:check + lint + audit event contract

**Blocked by:** None.
**Module/actor:** Platform; cả hai thành viên.
**What to build:** workspace pnpm, `env:check` (Node 22 LTS, pnpm 9, PG 16), ESLint + Prettier + TS strict, `.env.example` không bí mật, script `dev`/`test`, và hợp đồng audit (schema event + hàm emit) để ticket 3–8 chỉ việc emit theo.
**Scope:** gồm API khung + UI khung tối thiểu; không làm nghiệp vụ M02/M04.
**Acceptance criteria:**

- [ ] `pnpm env:check` pass khi đủ Node 22/pnpm 9/PG 16 và báo thiếu rõ ràng khi thiếu.
- [ ] Lint + format + typecheck chạy bằng một nhóm lệnh được tài liệu hóa.
- [ ] Contract audit (schema + emit) được ticket sau dùng được mà không sửa lại.
- [ ] Lệnh test: nhóm lệnh lint/typecheck/env:check trong README.

## 2. DB-01 — Schema project/member + dev/test DB

**Blocked by:** PLAT-01.
**Module/actor:** M01; Platform.
**What to build:** hai database `testtrace_dev`/`testtrace_test` tách biệt, migration đầu tiên, unique `(projectId, code)`, isolation `projectId`.
**Acceptance criteria:**

- [ ] Hai project không đọc chéo dữ liệu (integration test).
- [ ] Mã trùng trong cùng project bị chặn, khác project được phép.
- [ ] Migration tiến được từ schema trước, có rollback plan.

## 3. AUTH-01 — Local login + JWT rotation

**Blocked by:** DB-01.
**Module/actor:** M01; mọi vai trò.
**What to build:** đăng nhập local (hash password), JWT access ngắn hạn + refresh token rotation, thu hồi token; emit audit theo contract PLAT-01; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Đăng nhập/refresh/thu hồi hoạt động end-to-end (API + UI tối thiểu).
- [ ] Refresh token cũ sau rotation không dùng lại được.
- [ ] Không thêm OAuth/SSO hay dependency ngoài spec.

## 4. AUTH-02 — RBAC matrix + 403 + member audit

**Blocked by:** AUTH-01.
**Module/actor:** M01; Owner/Manager/Tester/Viewer.
**What to build:** ma trận quyền 4 role, mã lỗi `403` ổn định, Owner cuối không tự hạ quyền, Viewer chỉ đọc, Tester không đổi gate/member; audit thao tác member.
**Acceptance criteria:**

- [ ] Cùng một API, 4 role cho 4 kết quả đúng ma trận (unit test ma trận quyền).
- [ ] Hành động bị cấm trả `403` mã ổn định; đổi vai trò hiệu lực ngay.
- [ ] Mọi thao tác member có audit event.

## 5. REQ-01 — Requirement CRUD + approve lifecycle

**Blocked by:** AUTH-02.
**Module/actor:** M02; BA/Tester.
**What to build:** CRUD requirement và acceptance criteria, lifecycle `DRAFT → APPROVED → DEPRECATED`, mã duy nhất trong project không tái sử dụng; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Tạo/sửa/duyệt/deprecate hoạt động end-to-end (API + UI tối thiểu).
- [ ] Mã trùng trong project bị chặn với mã lỗi ổn định.
- [ ] Chỉ requirement đã duyệt mới được tính covered.

## 6. REQ-02 — Risk scoring + revision + review task

**Blocked by:** REQ-01. Chạy song song với TEST-01.
**Module/actor:** M02; BA/Tester.
**What to build:** chấm impact/likelihood 1–5, hiển thị `riskScore = impact × likelihood`, sửa bản đã duyệt sinh revision + review task cho test liên quan, requirement chưa có test hiển thị `Uncovered`.
**Acceptance criteria:**

- [ ] Boundary thang 1–5 có test; revision cũ vẫn xem được.
- [ ] Sửa acceptance criteria tạo review task cho test liên quan.
- [ ] Risk matrix lọc được theo mức.

## 7. TEST-01 — Suite/case/steps + READY/clone/search

**Blocked by:** REQ-01. Chạy song song với REQ-02.
**Module/actor:** M04; Tester.
**What to build:** cây suite, test steps thứ tự liên tục, rule `READY` (có expected + ≥1 requirement link hoặc lý do độc lập), sửa `READY` sinh revision, clone giữ trace, tìm kiếm mã/tên/tag/priority; kèm UI tối thiểu.
**Quy tắc tách:** nếu PR vượt ~400 dòng thì tự tách search thành TEST-02.
**Acceptance criteria:**

- [ ] Chuyển `READY` thiếu expected/link bị chặn với mã lỗi ổn định.
- [ ] Clone không mất trace link; revision cũ tái lập được; retired không thêm vào run mới.
- [ ] Reorder steps trong transaction, thứ tự liên tục.

## 8. TRACE-01 — Link requirement–test 2 chiều + stale marking

**Blocked by:** REQ-01, TEST-01 (đã nới, không đợi REQ-02).
**Module/actor:** M02/M04; Tester.
**What to build:** gắn/gỡ link nhiều-nhiều, đọc 2 chiều, sửa AC đánh dấu link cần rà soát; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Chọn requirement thấy mọi test liên quan và ngược lại.
- [ ] Sửa AC đánh dấu link cần rà soát + review task.
- [ ] Liên kết sai project bị chặn.

## 9. AUDIT-01 — Audit read API

**Blocked by:** TRACE-01 (contract từ PLAT-01).
**Module/actor:** M08; Manager/Tester.
**What to build:** đọc audit theo khoảng thời gian/thực thể, kiểm chứng ticket 3–8 đã emit đủ; audit append-only.
**Acceptance criteria:**

- [ ] Mọi trạng thái hiển thị giải thích được bằng bản ghi nguồn.
- [ ] Export/lọc audit đúng phạm vi project và quyền.
- [ ] Không có log chứa secret/source nhạy cảm.

## 10. E2E-01 — Playwright full flow Slice 1

**Blocked by:** AUDIT-01.
**Module/actor:** Slice 1; cả hai thành viên.
**What to build:** E2E tạo project → requirement (risk + criteria) → test case (steps) → link 2 chiều → xem audit, chạy xanh theo README trên máy sạch.
**Acceptance criteria:**

- [ ] Luồng demo cuối Slice 1 chạy end-to-end, không dồn UI (mỗi ticket đã có UI tối thiểu).
- [ ] Dữ liệu demo reset được; seed idempotent mã cố định.
- [ ] Review chéo: người còn lại giải thích được thiết kế và test gap trước merge.
