# Slice 4 tickets (markdown-tracked — không publish GitHub vội)

**Tiến độ:** tick khi ticket xong (code + test xanh + review).

- [x] 1. CONTRACT-01 — Cầu Python + harness contract
- [x] 2. CORPUS-PY-01 — Bộ fixture Python + oracle (đỏ trước)
- [x] 3. DESIGN-BVA-01 — Engine BVA thuần
- [x] 4. DRAFT-01 — Model draft + review
- [x] 5. ADAPTER-PY-01 — Adapter Python đầy đủ
- [ ] 6. GEN-PATH-01 — Sinh draft từ path/decision
- [ ] 7. E2E-04 — Playwright CFG-to-test hai ngôn ngữ

Lane gợi ý: A đi 1→2→5; B đi 3→4; hội lại ở 6→7. B chờ thì review PR của A.

**Ghi chú phạm vi (nguồn: feedback duyệt breakdown):**

- BVA input UI (form nhập kiểu/miền/biên) DEFER có chủ đích sang đợt UI Test Design Studio sau này — engine + API đủ cho E2E-04, không rơi mất việc.
- GEN-PATH-01 chạm VIEW-01 (Slice 3): thêm nút/selection wiring trên viewer để chọn decision/path. Người làm viewer giữ sở hữu component, GEN-PATH-01 chỉ thêm wiring.

---

## 1. CONTRACT-01 — Cầu Python + harness contract

**Blocked by:** None (chỉ cần runner CFG-04 đã xong).
**Module/actor:** M13; Platform.
**What to build:** gọi stdlib `ast` qua `child_process` (source qua stdin, timeout kill, chỉ stdlib, không eval); check version Python trong `env:check`; 1 fixture smoke xanh qua runner hiện tại không sửa runner.
**Acceptance criteria:**

- [ ] Payload có ý đồ thực thi (`os.system`, `eval`) vẫn chỉ được parse, không chạy (test chứng minh).
- [ ] Timeout kill hoạt động; version Python thiếu/sai báo rõ trong `env:check`.

## 2. CORPUS-PY-01 — Bộ fixture Python + oracle (đỏ trước)

**Blocked by:** None (song song với CONTRACT-01).
**Module/actor:** M13; Platform.
**What to build:** fixture Python cho sequence/branch/loop/break/early-return/syntax-error/unsupported + oracle N/E/decision/complexity/range, nạp được vào runner tham số hóa — đang đỏ vì chưa có adapter.
**Acceptance criteria:**

- [ ] Fixture chạy đỏ qua runner với lý do rõ (chưa có adapter), không phải lỗi runner.
- [ ] Ép tuân thủ luật: không implementation trước oracle.

## 3. DESIGN-BVA-01 — Engine BVA thuần

**Blocked by:** None (song song).
**Module/actor:** M05; Platform.
**What to build:** nhập kiểu/miền hợp lệ/không hợp lệ/biên đóng-mở (dạng API + engine, chưa UI form) → điểm biên/sát dưới/sát trên/đại diện từng lớp.
**Acceptance criteria:**

- [ ] Boundary/property test: điểm trong/ngoài biên, biên đóng vs mở.
- [ ] UI form nhập miền defer rõ ràng sang đợt sau (không làm trong ticket này).

## 4. DRAFT-01 — Model draft + review

**Blocked by:** None (song song).
**Module/actor:** M05/M14; Tester.
**What to build:** bảng DesignModel/DesignInput/TestDraft/DraftReview + API Approve/Edit/Reject từng draft + diff bản sửa + dedupe fingerprint + UI duyệt.
**Acceptance criteria:**

- [ ] Reject không hiện lại với cùng fingerprint trừ khi input đổi.
- [ ] Draft đã duyệt tạo test case kèm trace links; đổi model không sửa test đã duyệt.

## 5. ADAPTER-PY-01 — Adapter Python đầy đủ

**Blocked by:** CONTRACT-01, CORPUS-PY-01.
**Module/actor:** M13; Platform.
**What to build:** sequence/branch/loop/early-return + syntax error dòng/cột + unsupported diagnostic + source mapping + capability matrix.
**Acceptance criteria:**

- [ ] Xanh toàn bộ corpus CORPUS-PY-01; metamorphic rename/reformat không đổi graph.
- [ ] Cùng thuật toán mẫu ở JS và Python cho decision/complexity tương đương.

## 6. GEN-PATH-01 — Sinh draft từ path/decision

**Blocked by:** ADAPTER-PY-01, DRAFT-01.
**Module/actor:** M14; Tester.
**What to build:** chọn decision/path trên CFG (wiring thêm vào viewer VIEW-01) → draft có predicates + technique + input gợi ý + confidence + oracle NEEDS_REVIEW khi chưa chắc + review diff.
**Acceptance criteria:**

- [ ] Mỗi draft mở ngược được graph/path nguồn; path-to-draft mapping test.
- [ ] Predicate simplification + duplicate detection có test.

## 7. E2E-04 — Playwright CFG-to-test hai ngôn ngữ

**Blocked by:** GEN-PATH-01.
**Module/actor:** Slice 4; cả hai thành viên.
**What to build:** cùng thuật toán JS + Python → CFG tương đương → chọn path sinh draft → duyệt → mở được test case, trên UI thật.
**Acceptance criteria:**

- [ ] Full flow xanh trên Chromium; fixture dùng lại cho demo bảo vệ.
- [ ] Điểm dừng Slice 4 được kiểm tra: Python contract xanh mới coi slice xong.
