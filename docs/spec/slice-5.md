## Problem Statement

Từ góc nhìn Tester/Manager: khi mã thay đổi, không biết requirement và test nào bị ảnh hưởng, regression chạy thừa hoặc sót; RTM hiện tại là tĩnh, không phản ánh code mới hay run mới. Nguồn: plan "Slice 5 — Impact và RTM sống" và demo cuối slice (đổi điều kiện, xem graph diff, regression đề xuất, requirement Trusted → Stale).

## Solution

Từ góc nhìn người dùng: đăng ký code unit (function) và link với requirement; khi có version mã mới, hệ thống ghép unit, so CFG, phân loại thay đổi, đề xuất regression có lý do; RTM tự cập nhật trạng thái theo run/defect/version mới nhất. Nguồn: plan M15/M16 + Q1–Q6 Slice 5.

## User Stories

1. As a Tester, I want đăng ký function đang phân tích thành code unit và link với requirement, so that biết requirement gắn với mã nào.
2. As a Tester, I want chọn 2 version mã và xem diff node/edge added/removed/modified + delta complexity, so that hiểu thay đổi cấu trúc.
3. As a Tester, I want đổi format/tên biến không báo impact cấu trúc, so that không bị nhiễu.
4. As a Tester, I want danh sách regression đề xuất kèm reason codes drill-down được tới diff và trace link, so that tin để chạy lại.
5. As a Manager, I want xem ma trận Requirement × Test Case với trạng thái Trusted/At risk/Stale/Uncovered kèm lý do, so that biết chỗ nào rủi ro.
6. As a Manager, I want lọc RTM theo risk/trạng thái/release và mở từng ô xem run/defect/code/change, so that truy được bằng chứng.
7. As a Tester, I want đổi điều kiện trong code làm requirement chuyển Trusted → Stale đúng, so that stale-test detection hoạt động.

## Implementation Decisions

Nguồn chung: plan M15/M16 + Q1–Q6 Slice 5.

- Code registry tối thiểu: `CodeArtifact` + `CodeVersion` (sourceHash chống trùng) + `CodeUnit` (language, qualifiedName, signatureHash) trích lúc phân tích + link `RequirementCodeUnit` (nguồn: Q1).
- Matching: theo (language + tên + signature); đổi tên cùng thân = moved; thêm/xóa rõ ràng (nguồn: Q2).
- Diff: chuẩn hóa trước khi so (format/tên biến không nhiễu); modified = cùng vị trí khác điều kiện (so slice tại range); delta complexity; path mới chưa cover được đánh dấu (nguồn: Q3).
- Ranking: direct-link cao nhất → path/decision overlap → cùng requirement fallback; `reasonCodes`, không điểm bí ẩn (nguồn: Q4).
- RTM: `UNCOVERED → STALE → AT_RISK → TRUSTED` + reason codes + timestamp; chỉ tính release/build đang chọn; không dữ liệu hiện `No evidence`, không 100% giả (nguồn: Q5).
- STALE trigger: code unit có analysis mới hơn lần chạy phù hợp gần nhất (nguồn: Q6).
- Không thêm framework ngoài spec; không sửa migration cũ.

## Testing Decisions

- Seams đã chốt: registry, diff thuần, ranking, RTM truth table, UI matrix/before-after, E2E trusted-to-stale.
- Diff: fixture no-op/rename/condition-change/branch add-remove/unit move + metamorphic.
- RTM: truth table cho state derivation; query integration nhiều release; E2E Uncovered → Trusted → Stale.
- Regression list drill-down tới diff và link có test.
- Mọi domain rule dùng tdd; review trước merge.

## Out of Scope

- Adapter mới (xong ở Slice 4).
- Quality gate/dashboard/report (Slice 6); RTM Slice 5 là dữ liệu để gate dùng.
- AI (M19).

## Further Notes

- Mọi mục có nguồn từ plan hoặc Q Slice 5; E2E-05 và review mới là căn cứ.
- Chưa publish GitHub; tiến độ tick trong `docs/spec/slice-5-tickets.md` sau khi chia ticket.
- Bước tiếp theo: `to-tickets` chia Slice 5.
