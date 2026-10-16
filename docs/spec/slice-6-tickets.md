# Slice 6 tickets (markdown-tracked — không publish GitHub vội)

**Tiến độ:** tick khi ticket xong (code + test xanh + review).

- [x] 1. GATE-01 — Rule schema + YAML editor + publish/version
- [x] 2. GATE-02 — Evaluator thuần
- [x] 3. GATE-03 — Evaluate API + snapshot
- [x] 4. REPORT-01 — CSV RTM/execution/defect + UI tải
- [ ] 5. REPORT-02 — CSV complexity/impact/gate/audit (mở rộng UI tải)
- [ ] 6. I18N-01 — Việt/Anh web UI
- [ ] 7. OPS-01 — Health/backup/seed/rehearsal
- [ ] 8. E2E-06 — Playwright release assurance

Thứ tự: {1, 4, 6, 7} → 2 → {3, 5} → 8. Lane: A đi 1→2→3→8; B đi 4→6→7→5 (sau khi 3 xong)→hội ở 8.

**Invariants giữ suốt implementation (nguồn: review breakdown):**

- Gate evaluation bất biến; gate đã publish thì khóa version (muốn sửa → version mới).
- Số trên export ≡ số trên UI (dùng chung query layer).
- Rehearsal xanh trên máy sạch theo README, không Docker.

**Defer đích danh (nguồn: review):** visual builder kéo-thả (GATE-01 chỉ YAML editor + validate); PDF export; API error messages không i18n; CSV headers giữ tiếng Anh.

---

## 1. GATE-01 — Rule schema + YAML editor + publish/version

**Blocked by:** None.
**Module/actor:** M17; Manager.
**What to build:** schema 5 luật v0 + YAML editor + validate cú pháp + publish khóa version mới + UI tạo gate. Lifecycle khép kín "soạn → kiểm tra → khóa".
**Acceptance criteria:**

- [ ] YAML sai schema báo lỗi rõ dòng/rule; publish xong version bất biến.
- [ ] Muốn sửa gate đã publish → tạo version mới (không sửa ngược).

## 2. GATE-02 — Evaluator thuần

**Blocked by:** GATE-01.
**Module/actor:** M17; Platform.
**What to build:** evaluator thuần trên snapshot (không cần DB): truth table từng luật + boundary test; thiếu dữ liệu → INDETERMINATE (không tự Pass).
**Acceptance criteria:**

- [ ] Unit test toàn bộ truth table + biên; cùng snapshot cho cùng kết quả.
- [ ] Dùng cùng ngôn ngữ INDETERMINATE với GATE-03 (thiếu nguồn nào → INDETERMINATE).

## 3. GATE-03 — Evaluate API + snapshot

**Blocked by:** GATE-02.
**Module/actor:** M17; Manager.
**What to build:** evaluate build: snapshot input + rule + kết quả từng rule + Pass/Fail/INDETERMINATE; drill-down tới bản ghi vi phạm; release PASSED chỉ khi Pass; UI chạy gate.
**5 nguồn dữ liệu liệt kê rõ:** RTM states (Slice 5), results (Slice 2), defects (Slice 2), complexity (Slice 3), stale (Slice 5). Thiếu nguồn → INDETERMINATE.
**Acceptance criteria:**

- [ ] Evaluate 2 lần cùng snapshot cho cùng kết quả; lịch sử bất biến.
- [ ] Mỗi rule drill-down được; release chỉ PASSED khi evaluation Pass.

## 4. REPORT-01 — CSV RTM/execution/defect + UI tải

**Blocked by:** None.
**Module/actor:** M18; Manager.
**What to build:** export CSV 3 báo cáo dùng chung query với UI + UI tải tối thiểu cho chính 3 export này.
**Acceptance criteria:**

- [ ] Số CSV khớp số UI (reconciliation test); export ghi thời điểm + bộ lọc + project.
- [ ] E2E-06 chỉ dùng export của ticket này.

## 5. REPORT-02 — CSV complexity/impact/gate/audit

**Blocked by:** GATE-03.
**Module/actor:** M18; Manager.
**What to build:** export 4 báo cáo còn lại, mở rộng cùng UI tải của REPORT-01.
**Acceptance criteria:**

- [ ] Số CSV khớp số UI; audit export theo khoảng thời gian/thực thể.

## 6. I18N-01 — Việt/Anh web UI

**Blocked by:** None.
**Module/actor:** M20; User.
**What to build:** dictionary vi/en tách khỏi component (scope = web UI), mặc định tiếng Việt, chuyển đổi giữ context.
**Acceptance criteria:**

- [ ] Test quét missing keys xanh; cấm string cứng mới sau ticket này.
- [ ] API error messages và CSV headers KHÔNG i18n (defer đích danh).

## 7. OPS-01 — Health/backup/seed/rehearsal

**Blocked by:** None.
**Module/actor:** M20; cả hai thành viên.
**What to build:** `GET /api/health` (check DB), script backup/restore, seed `TestTrace Self-Test` idempotent, README rehearsal.
**Acceptance criteria (done signal):** rehearsal xanh trên máy sạch theo README (cả 2 máy), migration from empty ok, backup-restore drill ok.

## 8. E2E-06 — Playwright release assurance

**Blocked by:** GATE-03, REPORT-01.
**Module/actor:** Slice 6; cả hai thành viên.
**What to build:** publish gate → evaluate Fail → drill-down → run mới sửa dữ liệu → evaluate Pass → export CSV (REPORT-01), trên UI thật.
**Acceptance criteria:**

- [ ] Full flow xanh trên Chromium; CSV tải về khớp UI.
- [ ] Điểm dừng Slice 6 (và toàn đồ án mốc Assurance) được kiểm tra.
