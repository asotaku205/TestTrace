# Slice 2 tickets (markdown-tracked — không publish GitHub vội)

**Tiến độ:** tick khi ticket xong (code + test xanh + review).

- [x] 1. REL-01 — Release/build/environment + freeze
- [x] 2. RUN-01 — Lập run + snapshot revision
- [x] 3. RUN-02 — Thực thi + finalize
- [x] 4. BUG-01 — Defect + state machine
- [x] 5. BUG-02 — Tạo defect từ Fail + retest link
- [x] 6. EVID-01 — Đính kèm evidence
- [x] 7. E2E-02 — Playwright fail-to-close

Lane gợi ý: A đi 1→2→3→5; B đi 4→6 (sau khi 3 xong)→hội lại 7 cùng A; B chờ thì review PR của A.

**Invariant bắt buộc (nguồn: feedback duyệt breakdown):**

- RUN-01: kết quả trong RUN-02 trỏ tới snapshot, không trỏ test case live — sửa test sau này không viết lại lịch sử.
- RUN-02: progress tính realtime từ items, không lưu field riêng (tránh drift số liệu).

---

## 1. REL-01 — Release/build/environment + freeze

**Blocked by:** None.
**Module/actor:** M03; Manager.
**What to build:** CRUD release/build/environment; build number duy nhất trong release; freeze release; `RELEASED` bất biến; cấm xóa environment đã có run; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Build trùng number trong cùng release bị chặn mã ổn định; khác release được phép.
- [ ] Freeze xong không sửa dữ liệu nền; release timeline đúng.
- [ ] Xóa environment đã có run bị cấm; chưa có run xóa được.
- [ ] Lệnh test: unit transition + integration ràng buộc build–project.

## 2. RUN-01 — Lập run + snapshot revision

**Blocked by:** REL-01.
**Module/actor:** M06; Tester.
**What to build:** tạo run từ suite/bộ lọc + bộ ba release–build–environment; snapshot revision test case lúc tạo; sinh items + assignment; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Item trỏ snapshot revision, không trỏ test live (invariant).
- [ ] Hai Tester nhận item khác nhau được; run rỗng không báo 100%.
- [ ] Không gắn run vào build khác project.

## 3. RUN-02 — Thực thi + finalize

**Blocked by:** RUN-01.
**Module/actor:** M06; Tester.
**What to build:** nhập PASS/FAIL/BLOCKED/SKIPPED theo step; FAIL cần actual, BLOCKED cần lý do; finalize tạo summary bất biến; progress realtime từ items; optimistic locking chống ghi đè; kèm UI execution board.
**Acceptance criteria:**

- [ ] FAIL thiếu actual / BLOCKED thiếu lý do bị chặn mã ổn định.
- [ ] Run hoàn tất không sửa được; retest là execution mới.
- [ ] Hai người finalize cùng lúc không mất dữ liệu (1 thắng, 1 báo xung đột mã ổn định).

## 4. BUG-01 — Defect + state machine

**Blocked by:** REL-01 (chạy song song với RUN-01/RUN-02; defect tồn tại độc lập run).
**Module/actor:** M07; Tester/Developer/Manager.
**What to build:** CRUD defect (severity/priority/bước tái hiện); machine đầy đủ + quyền transition + fixed build + `DefectHistory`; timeline; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Unit test toàn bộ transition hợp lệ + mọi transition sai trả lỗi domain.
- [ ] Hạ quyền/xóa Owner không liên quan ở đây, nhưng `FIXED` thiếu fixed build bị chặn; chỉ Tester/Manager `CLOSED`.
- [ ] Timeline ghi ai đổi gì khi nào; truy ngược result/requirement/build.

## 5. BUG-02 — Tạo defect từ Fail + retest link

**Blocked by:** RUN-02, BUG-01.
**Module/actor:** M07/M06; Tester.
**What to build:** tạo defect từ kết quả Fail (giữ link result); retest trên build mới; Pass → `CLOSED`, Fail → `REOPENED`; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Defect tạo từ Fail giữ link về result + requirement + build gốc.
- [ ] Retest Pass đóng được; retest Fail reopen với lịch sử đầy đủ.

## 6. EVID-01 — Đính kèm evidence

**Blocked by:** RUN-02, BUG-01.
**Module/actor:** M08; Tester.
**What to build:** upload ảnh/log/text ≤ 10MB lưu ngoài DB + checksum + sanitize tên file; gắn cho result/defect; phân quyền tải; xóa nghiệp vụ chỉ đổi trạng thái lưu trữ; kèm UI tối thiểu.
**Acceptance criteria:**

- [ ] Path traversal, MIME giả, file quá lớn đều bị chặn có mã ổn định.
- [ ] Tải đúng file đúng quyền; checksum phát hiện đổi nội dung.

## 7. E2E-02 — Playwright fail-to-close

**Blocked by:** BUG-02 (đã nới; flow không đụng evidence).
**Module/actor:** Slice 2; cả hai thành viên.
**What to build:** E2E release → run → Fail → defect → Fixed → retest Pass → Closed trên UI thật, chạy xanh theo README.
**Acceptance criteria:**

- [ ] Full flow xanh trên Chromium; dữ liệu có hậu tố duy nhất để chạy lặp.
- [ ] Review chéo trước merge như mọi ticket.
