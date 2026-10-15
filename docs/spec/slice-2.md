## Problem Statement

Từ góc nhìn người dùng (Tester/Manager): sau Slice 1 đã có requirement và test case, nhưng chưa ghi được ai chạy test nào trên build nào, kết quả và bằng chứng ra sao; lỗi phát hiện chưa nối với bằng chứng thất bại và chưa chứng minh được retest. Nguồn: plan "Slice 2 — Test run đến defect và retest" và demo cuối slice (tạo release/build, lập run, ghi Fail, tạo defect, chuyển Fixed, retest Pass, đóng lỗi).

## Solution

Từ góc nhìn người dùng: Manager tạo release/build/environment; Tester lập run từ suite hoặc bộ lọc (snapshot revision test), thực hiện từng case (`PASS`/`FAIL`/`BLOCKED`/`SKIPPED`) rồi hoàn tất run; từ kết quả Fail tạo defect có severity/priority/bước tái hiện, đi qua state machine tới `FIXED` trên build mới, retest Pass thì đóng (Fail thì reopen); đính kèm evidence cho result/defect. Nguồn: plan M03/M06/M07/M08 + Q1–Q6 Slice 2.

## User Stories

1. As a Manager, I want tạo release với trạng thái `DRAFT`, so that chuẩn bị phiên bản kiểm định.
2. As a Manager, I want khai báo build (number duy nhất trong release) và environment (Local/Test/Staging), so that run gắn đúng bản được kiểm định.
3. As a Manager, I want freeze release, so that dữ liệu nền không đổi giữa chừng.
4. As a Tester, I want tạo run từ suite hoặc bộ lọc, chọn bộ ba release–build–environment, so that phạm vi chạy rõ ràng.
5. As a Tester, I want run lưu snapshot revision test case, so that sửa test sau này không làm sai lệch bằng chứng.
6. As a Tester, I want thực hiện từng case với precondition/steps/expected hiển thị, nhập actual result, chọn `PASS`/`FAIL`/`BLOCKED`/`SKIPPED`, so that kết quả có căn cứ.
7. As a Tester, I want `FAIL` bắt buộc actual result và `BLOCKED` bắt buộc lý do, so that thất bại nào cũng giải thích được.
8. As a Tester, I want hai Tester chạy item khác nhau cùng lúc, refresh không mất nháp, so that chia việc được.
9. As a Tester, I want hoàn tất run tạo summary bất biến, so that không ai sửa ngược kết quả.
10. As a Tester, I want từ kết quả Fail tạo defect kèm severity/priority/bước tái hiện, so that lỗi nối với bằng chứng thất bại.
11. As a Developer, I want chuyển defect `NEW → TRIAGED → ASSIGNED → IN_PROGRESS → FIXED` với fixed build, so that tiến độ sửa minh bạch.
12. As a Tester, I want retest trên build mới rồi đóng (`CLOSED`) hoặc reopen khi vẫn Fail, so that vòng đời khép kín có chứng minh.
13. As a Manager, I want xem timeline defect (ai đổi gì khi nào) và truy ngược test result/requirement/build, so that kiểm toán được.
14. As a Tester, I want đính kèm ảnh/log cho result/defect (≤ 10MB, đúng loại), so that bằng chứng đầy đủ.
15. As a Manager, I want progress run tính trên item thực tế và trạng thái rỗng riêng, so that không có số 100% giả.
16. As a Viewer, I want chỉ đọc run/defect/evidence, so that không phá bằng chứng.

## Implementation Decisions

Nguồn chung: plan M03/M06/M07/M08 + Q1–Q6 Slice 2.

- Module trong phạm vi: M03 (release, build, environment), M06 (run, item, result, step result, assignment), M07 (defect, link, history, comment, retest link), M08 phần evidence file (audit event đã có từ Slice 1).
- Release: trạng thái `DRAFT`/`IN_TEST`/`PASSED`/`FAILED`/`RELEASED`/`ARCHIVED`; build number duy nhất trong release; `RELEASED` bất biến dữ liệu nền; cấm xóa environment đã có run; quality gate đánh giá trên snapshot build cụ thể (nguồn: Q1).
- Run: snapshot revision test case lúc tạo run; `FAIL` cần actual result, `BLOCKED` cần lý do; run hoàn tất bất biến, retest là execution mới; progress = done/total thực tế; optimistic locking khi finalize; assignment cho phép hai Tester chia item (nguồn: Q2, Q6).
- Defect: state machine `NEW → TRIAGED → ASSIGNED → IN_PROGRESS → FIXED → RETEST → CLOSED` + `REJECTED`/`REOPENED`; transition giới hạn vai trò; `FIXED` cần fixed build; chỉ Tester/Manager `CLOSED`; retest Fail → `REOPENED`; severity `BLOCKER`/`CRITICAL`/`MAJOR`/`MINOR`/`TRIVIAL` tách khỏi priority; mọi transition ghi `DefectHistory` (nguồn: Q3, Q4).
- Evidence: nhận ảnh/log/text ≤ 10MB/file; lưu ngoài DB (`storage/`), PostgreSQL giữ metadata + checksum + link; sanitize tên file chống path traversal; kiểm tra MIME thật; xóa nghiệp vụ chuyển trạng thái lưu trữ; audit event chỉ append (nguồn: Q5).
- Hợp đồng chung Slice 1 giữ nguyên: UUID + mã/human code duy nhất trong project (`REL-?`, `RUN-?`, `BUG-?` theo cùng quy tắc), UTC, mã lỗi ổn định, phân trang/lọc/sắp xếp, controller → use case → domain (nguồn: Q10 Slice 1).
- Không thêm framework/dependency ngoài stack plan; không sửa migration cũ; không thực thi mã đầu vào.

## Testing Decisions

- Cái gì là test tốt ở Slice 2: assert hành vi ở seam tương ứng, không assert cài đặt.
- Seams đã chốt với người dùng: (1) domain cho state machine/transition quyền/progress; (2) API cho release/run/defect/evidence; (3) persistence cho snapshot bất biến/build unique/history; (4) storage cho upload ngoài DB + checksum; (5) E2E Playwright Fail → defect → Fixed → Retest → Closed.
- Module được test: unit toàn bộ defect state machine + quyền transition; boundary build unique; concurrent finalize; path traversal/MIME giả/file quá lớn/quyền tải; E2E tạo release-build-env, lập run, pass/fail/block, tạo defect từ Fail, Fixed, retest Pass → Closed và nhánh Reopened (nguồn: plan M03/M06/M07/M08 mục Kiểm thử).
- Mọi domain rule dùng tdd; code-review trước merge; diagnosing-bugs khi fail bất thường.

## Out of Scope

- CFG/adapter/test-generator (Slice 3–4).
- Impact radar/RTM đầy đủ (Slice 5); Slice 2 chỉ đảm bảo kết quả mới nhất được RTM sau này dùng đúng.
- Quality gate/dashboard/report (Slice 6).
- Invitation user chưa có tài khoản (gap từ AUTH-02, ticket riêng sau Slice 2 nếu cần).
- TestDataSet/bulk-action/Tag entity (gap từ TEST-01).

## Further Notes

- Mọi mục đều có nguồn từ plan hoặc Q Slice 2; chưa gì được đánh dấu đúng/hoàn thành, E2E-02 và review mới là căn cứ.
- Chưa publish GitHub (theo quyết định track bằng markdown); tiến độ tick trong `docs/spec/slice-2-tickets.md` sau khi chia ticket.
- Bước tiếp theo: `to-tickets` chia Slice 2, mỗi ticket một vertical behavior review được trong một lần đọc.
