## Problem Statement

Từ góc nhìn Tester: đã thấy CFG và complexity (Slice 3) nhưng vẫn phải tự nghĩ test cho từng nhánh/biên; với Python thì chưa phân tích được gì. Nguồn: plan "Slice 4 — Test generation và ngôn ngữ thứ hai" và demo cuối slice (cùng thuật toán ở JS/TS và Python cho CFG tương đương; chọn path sinh draft, duyệt thành test case).

## Solution

Từ góc nhìn người dùng: phân tích cùng thuật toán ở Python cho CFG tương đương JS; nhập miền dữ liệu để sinh điểm biên; chọn decision/basis path để sinh test draft có lý do, input gợi ý và oracle cần xác nhận; duyệt từng draft (Approve/Edit/Reject) thành test case thật giữ trace links. Nguồn: plan M05/M13/M14 + Q1–Q6 Slice 4.

## User Stories

1. As a Tester, I want dán hàm Python và nhận CFG tương đương bản JS, so that đa ngôn ngữ là thật không phải slogan.
2. As a Tester, I want cú pháp Python lỗi hoặc chưa hỗ trợ báo dòng/cột, so that tin được graph.
3. As a Tester, I want nhập kiểu + miền hợp lệ/không hợp lệ + biên đóng/mở và nhận điểm biên/sát dưới/sát trên/đại diện, so that kỹ thuật BVA thành công cụ.
4. As a Tester, I want chọn một decision hoặc basis path và nhận draft ghi rõ predicates + kỹ thuật + input gợi ý + confidence, so that biết vì sao test này được sinh.
5. As a Tester, I want expected chưa chắc chắn gắn `NEEDS_REVIEW` bắt buộc tôi xác nhận, so that không có oracle mơ hồ lọt vào kho test.
6. As a Tester, I want duyệt/sửa/từ chối từng draft; bản sửa giữ diff; từ chối không hiện lại với cùng fingerprint, so that kiểm soát được đầu ra.
7. As a Tester, I want draft đã duyệt thành test case kèm trace links về design model và graph/path nguồn, so that truy vết được.
8. As a Tester, I want đổi model không âm thầm sửa test đã duyệt, so that quyết định của tôi được tôn trọng.

## Implementation Decisions

Nguồn chung: plan M05/M13/M14 + Q1–Q6 Slice 4.

- Parser Python: stdlib `ast` qua `child_process` (stdin, timeout kill, chỉ stdlib, không eval); version Python ghi vào `env:check`; không dependency npm mới cho parse (nguồn: Q1).
- Corpus Python: cùng thuật toán mẫu viết lại Python, oracle riêng, chạy bằng contract runner hiện tại không sửa runner (nguồn: Q2).
- TestDraft đúng M14 + review workflow + fingerprint dedupe; draft trùng gộp nhưng giữ nhiều nguồn (nguồn: Q3).
- Phạm vi Slice 4: BVA/equivalence + sinh từ path/decision; decision table/state/pairwise defer (nguồn: Q4).
- Confidence không tự approve; oracle không chắc → `NEEDS_REVIEW` (nguồn: Q5).
- Capability Python: sequence/branch/loop/early-return + syntax error; match/try/async/generator defer + diagnostic (nguồn: Q6).
- Engine theo luật chạy không cần AI; M19 để sau.
- Không thêm framework ngoài spec; không sửa migration cũ.

## Testing Decisions

- Seams đã chốt: (1) adapter Python qua contract; (2) BVA engine thuần; (3) draft/review; (4) path-to-draft; (5) E2E CFG-to-test hai ngôn ngữ.
- BVA: boundary/property test (điểm biên trong/ngoài, biên đóng-mở); pairwise coverage để sau.
- Adapter Python: contract + fixture riêng + syntax error + unsupported + source mapping + metamorphic rename/reformat.
- Path-to-draft: mapping test, predicate simplification test, duplicate detection test, review workflow test.
- E2E: nhập model → draft → duyệt → mở test case; graph → draft → test case.
- Security: timeout kill parser, giới hạn input như Slice 3, không thực thi mã (test chứng minh bằng payload có ý đồ thực thi vẫn chỉ parse).

## Out of Scope

- Adapter Java/C/C++ (Slice sau).
- Decision table, state transition, pairwise (ticket riêng sau).
- Impact radar/RTM/gate (Slice 5–6).
- AI (M19).

## Further Notes

- Mọi mục có nguồn từ plan hoặc Q Slice 4; E2E-04 và review mới là căn cứ.
- Chưa publish GitHub; tiến độ tick trong `docs/spec/slice-4-tickets.md` sau khi chia ticket.
- Bước tiếp theo: `to-tickets` chia Slice 4.
