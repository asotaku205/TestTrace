# Slice 5 tickets (markdown-tracked — không publish GitHub vội)

**Tiến độ:** tick khi ticket xong (code + test xanh + review).

- [x] 1. REG-01 — Code registry + links
- [x] 2. DIFF-01 — Unit matching
- [x] 3. DIFF-02 — Graph diff + delta
- [x] 4. IMPACT-01 — Ranking + regression list
- [x] 5. RTM-01 — State derivation + API
- [x] 6. RTM-02 — Matrix UI
- [ ] 7. E2E-05 — Playwright trusted-to-stale

Lane gợi ý: A đi 1→2→3→4; B chờ 1 xong làm 5→6 (trong lúc chờ thì viết fixture matching cho 2 + review); hội ở 7.

**Bộ reasonCode dùng chung IMPACT-01 ↔ RTM-01 (nguồn: feedback duyệt — một từ vựng, không hai sự thật):**
`DIRECT_LINK` (test gắn trực tiếp unit đổi) · `PATH_CHANGED` (path/decision đổi) ·
`SAME_REQUIREMENT` (cùng requirement fallback) · `CODE_CHANGED` (hash unit đổi sau run) ·
`FAIL_OPEN` (Fail/Blocked mở) · `DEFECT_OPEN` (Blocker/Critical mở) · `NO_TEST` (không test active)

**Thứ tự ưu tiên truth table:** UNCOVERED > STALE > AT_RISK > TRUSTED.

---

## 1. REG-01 — Code registry + links

**Blocked by:** None.
**Module/actor:** M09; Tester.
**What to build:** trích unit (language, qualifiedName, signatureHash) lúc phân tích qua hook vào pipeline ANALYSIS-01 (extend, không refactor orchestrator); version lưu sourceHash; API + UI link requirement–unit.
**Acceptance criteria:**

- [ ] Upload trùng sourceHash không tạo version trùng.
- [ ] Cùng unit nhận diện ổn định qua các version (locator), source range theo từng version.
- [ ] Liên kết sai project bị chặn.

## 2. DIFF-01 — Unit matching

**Blocked by:** REG-01.
**Module/actor:** M15; Platform.
**What to build:** ghép 2 version: same/renamed(moved)/added/removed; fixture do B viết trước được (chỉ cần schema registry).
**Acceptance criteria:**

- [ ] Fixture: no-op, rename, add, remove, move unit.
- [ ] Đổi tên cùng thân = moved, không phải modified.

## 3. DIFF-02 — Graph diff + delta

**Blocked by:** DIFF-01.
**Module/actor:** M15; Platform.
**What to build:** so 2 CFG đã chuẩn hóa: node/edge added/removed/modified (modified = cùng vị trí khác điều kiện, so slice tại range); delta complexity; path mới chưa cover đánh dấu.
**Acceptance criteria:**

- [ ] Đổi format/tên biến không tạo impact cấu trúc (metamorphic).
- [ ] Failure không để diff nửa vời.

## 4. IMPACT-01 — Ranking + regression list

**Blocked by:** DIFF-02.
**Module/actor:** M15; Tester.
**What to build:** xếp hạng direct → path/decision → same-requirement với reasonCode dùng chung ở trên; list drill-down tới diff + trace link; UI đề xuất nhất quán với viewer (một sự thật về CFG).
**Acceptance criteria:**

- [ ] Mọi đề xuất có reasonCode trong bộ chung; không điểm bí ẩn.
- [ ] Drill-down mở được diff và bản ghi nguồn.

## 5. RTM-01 — State derivation + API

**Blocked by:** REG-01 (song song với chuỗi DIFF).
**Module/actor:** M16; Manager/Tester.
**What to build:** truth table + API ma trận theo release/build đang chọn.
**Predicate STALE (hash-based, nguồn: feedback duyệt):** STALE ⟺ unit liên kết có sourceHash hiện tại ≠ sourceHash ghi nhận ở lần run finalized gần nhất. Không dùng kết quả impact (cách B) — giữ song song với chuỗi DIFF.
**Acceptance criteria:**

- [ ] Truth table phủ 4 trạng thái + thứ tự UNCOVERED > STALE > AT_RISK > TRUSTED.
- [ ] Mọi trạng thái kèm reasonCode trong bộ chung + timestamp.
- [ ] Không dữ liệu hiện `No evidence`, không 100% giả.
- [ ] reason thiết kế để IMPACT-01 enrich thêm được (cùng từ vựng).

## 6. RTM-02 — Matrix UI

**Blocked by:** RTM-01.
**Module/actor:** M16; Manager.
**What to build:** ma trận Requirement × Test + lọc risk/trạng thái/release + mở từng ô xem run/defect/code/change.
**Acceptance criteria:**

- [ ] Mọi KPI drill-down được; export giữ cùng bộ lọc.
- [ ] Project rỗng có empty state đúng.

## 7. E2E-05 — Playwright trusted-to-stale

**Blocked by:** IMPACT-01, RTM-02.
**Module/actor:** Slice 5; cả hai thành viên.
**What to build:** đổi điều kiện trong code → graph diff → regression đề xuất → requirement Trusted → Stale, trên UI thật.
**Acceptance criteria:**

- [ ] Full flow xanh trên Chromium; reason hiển thị nhất quán 2 UI.
- [ ] Điểm dừng Slice 5 được kiểm tra: fixture diff xanh + RTM đổi đúng.
