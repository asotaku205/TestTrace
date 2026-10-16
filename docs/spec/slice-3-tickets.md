# Slice 3 tickets (markdown-tracked — không publish GitHub vội)

**Tiến độ:** tick khi ticket xong (code + test xanh + review).

- [x] 1. CFG-01 — Neutral IR + builder
- [x] 2. CFG-04 — Corpus 4 fixture + contract runner
- [x] 3. ADAPTER-JS-01 — Parser PoC (guardrails)
- [x] 4. CFG-02 — Validator
- [x] 5. CFG-03 — Metrics + basis paths
- [x] 6. ADAPTER-JS-02 — Adapter đầy đủ (không try/catch)
- [x] 7. ANALYSIS-01 — Orchestrator + persistence/API
- [ ] 8. VIEW-01 — Graph viewer (khởi động sớm từ fixture)
- [ ] 9. E2E-03 — Playwright CFG demo

Lane gợi ý: A đi 1→2→4→5→6; B đi 3 (sau 1) → 7 (sau 6); VIEW-01 (8) khởi động sớm từ fixture sau ticket 2, chốt integration ở 9.

**Quyết định scope (nguồn: feedback duyệt breakdown):**

- try/catch/finally DEFER khỏi ADAPTER-JS-02; capability matrix ghi "chưa hỗ trợ", gặp thì trả diagnostic có dòng/cột. Không để lửng.
- ADAPTER-JS-02 có nguy cơ tách nhất slice; đường tách dự phòng: core constructs trước, diagnostics + capability sau. Chưa tách trước.

---

## 1. CFG-01 — Neutral IR + builder

**Blocked by:** None.
**Module/actor:** M11; Platform.
**What to build:** types 9 node + 6 edge + sourceRange + metadata; builder thuần dựng graph; unit test.
**Acceptance criteria:**

- [ ] ID ổn định trong cùng analysis; mọi edge trỏ node tồn tại (validator chi tiết ở CFG-02).
- [ ] Không dependency parser; `cfg-core` không biết HTTP/UI/Prisma.

## 2. CFG-04 — Corpus 4 fixture + contract runner

**Blocked by:** CFG-01.
**Module/actor:** M11/M13; cả hai thành viên.
**What to build:** 4 fixture (tuần tự M=1, if/else, loop break/continue, early return) với oracle N/E/decision/complexity/range; **runner tham số hóa theo adapter** (nhận adapter bất kỳ + fixture → assert oracle), không hardcode IR viết tay.
**Acceptance criteria:**

- [ ] Runner dùng được cho adapter tương lai (Python/Java/C/C++) mà không sửa runner.
- [ ] Không snapshot toàn bộ JSON; assert bất biến đồ thị.

## 3. ADAPTER-JS-01 — Parser PoC (có guardrails)

**Blocked by:** CFG-01.
**Module/actor:** M13; Platform.
**What to build:** PoC `@babel/parser` trên 1 hàm mẫu ra IR đúng, kiểm chứng đúng điều kiện Q1 (location chính xác + hỗ trợ TS).
**Guardrails (nguồn: feedback duyệt):**

- Tiêu chí fail viết trước: fail nếu không lấy được source range chính xác hoặc phải hack để walk AST.
- Fallback: fail thì quay lại Q1 đánh giá parser khác; chữ "chính thức" có răng.
- Timebox ~1 ngày; quá hạn chưa xong bản thân đã là tín hiệu xấu.
  **Acceptance criteria:**
- [ ] Ra IR đúng cho 1 hàm mẫu (assert bằng runner CFG-04).
- [ ] Kết luận chọn/không chọn Babel ghi thành văn bản ngắn trong ticket.

## 4. CFG-02 — Validator

**Blocked by:** CFG-01, CFG-04.
**Module/actor:** M11; Platform.
**What to build:** kiểm edge→node, entry/exit mỗi component, unreachable đánh dấu không tự xóa.
**Acceptance criteria:**

- [ ] Fixture lỗi đi qua validator với diagnostic rõ ràng.
- [ ] Property test: sinh graph nhỏ, mọi edge trỏ node tồn tại.

## 5. CFG-03 — Metrics + basis paths

**Blocked by:** CFG-01, CFG-04 (đã nới; độc lập CFG-02 vì đều là hàm thuần trên IR).
**Module/actor:** M11; Platform.
**What to build:** `M = E - N + 2P`, decision points, basis paths trong ngưỡng (paths ≤ 200).
**Acceptance criteria:**

- [ ] Đúng trên toàn bộ fixture đã duyệt; complexity không âm (property).
- [ ] Metamorphic: đổi tên biến/format không đổi cấu trúc.

## 6. ADAPTER-JS-02 — Adapter đầy đủ (không try/catch)

**Blocked by:** ADAPTER-JS-01, CFG-03.
**Module/actor:** M13; Platform.
**What to build:** sequence/branch/loop/break-continue/early-return + detector + source locator + diagnostic mapper + capability matrix; try/catch DEFER (diagnostic dòng/cột).
**Acceptance criteria:**

- [ ] Xanh contract suite CFG-04; cùng thuật toán cho decision/complexity đúng oracle.
- [ ] Syntax error vs unsupported phân biệt rõ; metadata riêng không rò vào core.
- [ ] Nếu PR vượt review một lần: tách diagnostics + capability thành ticket con.

## 7. ANALYSIS-01 — Orchestrator + persistence/API

**Blocked by:** ADAPTER-JS-02.
**Module/actor:** M09/M10; Platform.
**What to build:** registry + capability check + idempotency (`sourceHash + adapterVersion + configHash`) + timeout/partial + lưu Analysis/Payload + API phân tích; kèm UI nhập liệu tối thiểu.
**Acceptance criteria:**

- [ ] Cùng input/config trả cùng graph chuẩn hóa; adapter không tồn tại trả capability list.
- [ ] Failure không để graph nửa vời; không thực thi mã đầu vào (test chứng minh).
- [ ] Source trùng hash không phân tích lại.

## 8. VIEW-01 — Graph viewer (khởi động sớm từ fixture)

**Blocked by:** CFG-04 (dựng UI trên fixture IR; chốt integration với adapter thật ở E2E-03).
**Module/actor:** M12; Quality Experience.
**What to build:** split code–graph, click node highlight source, legend, filter exception/loop edge, metrics panel, path explorer, export SVG/JSON kèm adapter/version/config.
**Acceptance criteria:**

- [ ] Node map đúng source range; zoom/pan ổn định; không treo với graph lớn (thu gọn).
- [ ] Keyboard focus + mô tả text cho accessibility.

## 9. E2E-03 — Playwright CFG demo

**Blocked by:** ANALYSIS-01, VIEW-01.
**Module/actor:** Slice 3; cả hai thành viên.
**What to build:** dán hàm → phân tích → CFG + complexity + paths → highlight source → export, trên UI thật.
**Acceptance criteria:**

- [ ] Full flow xanh trên Chromium; fixture dùng lại được cho demo bảo vệ.
- [ ] Điểm dừng bắt buộc được kiểm tra: contract suite xanh mới coi slice xong (không mở Python).
