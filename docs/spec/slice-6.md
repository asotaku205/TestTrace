## Problem Statement

Từ góc nhìn Manager: sau 5 slice đã có đầy đủ dữ liệu kiểm định nhưng quyết định release vẫn cảm tính, báo cáo nộp môn chưa có, cài máy mới chưa chắc chạy, UI mới tiếng Việt. Nguồn: plan "Slice 6 — Gate và hồ sơ kiểm định" và demo cuối slice (chạy gate, drill-down vi phạm, sửa bằng run mới, evaluate lại, export hồ sơ).

## Solution

Từ góc nhìn người dùng: tạo quality gate từ rule builder/YAML, evaluate một build cho kết quả Pass/Fail tái lập kèm drill-down; export CSV các báo cáo khớp số UI; đổi ngôn ngữ Việt/Anh không mất context; cài máy sạch theo README + health check + backup/restore + seed dogfooding. Nguồn: plan M17/M18/M20 + Q1–Q6 Slice 6.

## User Stories

1. As a Manager, I want tạo gate từ rule builder hoặc YAML và kiểm tra cú pháp, so that luật rõ ràng trước khi khóa.
2. As a Manager, I want khóa version gate và evaluate một build, so that kết quả gắn với bản luật cụ thể.
3. As a Manager, I want mỗi rule drill-down tới bản ghi vi phạm, so that biết phải sửa gì.
4. As a Manager, I want rule thiếu dữ liệu báo `INDETERMINATE` thay vì tự Pass, so that không quyết định trên số bịa.
5. As a Tester, I want sửa dữ liệu bằng run mới rồi evaluate lại ra Pass, so that vòng cải thiện khép kín.
6. As a Manager, I want export CSV RTM/execution/defect/complexity/impact/gate/audit khớp số UI, so that nộp hồ sơ được.
7. As a User, I want đổi Việt/Anh không mất context làm việc, so that demo được 2 ngôn ngữ.
8. As a Member, I want cài máy sạch theo README + health check xanh + seed chạy lặp an toàn, so that 2 máy giống nhau.
9. As a Member, I want backup/restore thử được, so that dữ liệu demo không mất.

## Implementation Decisions

Nguồn chung: plan M17/M18/M20 + Q1–Q6 Slice 6.

- Luật v0: uncovered-high-risk, open-blocker/critical, stale-tests, pass-rate-min, max-complexity; branch-coverage và required-suites → `INDETERMINATE` (nguồn: Q1).
- Gate version khóa khi publish; evaluation bất biến (snapshot input + rule + kết quả); release `PASSED` chỉ khi evaluation Pass (nguồn: Q2).
- Export CSV trước, PDF defer; số liệu report dùng cùng query/service với dashboard (nguồn: Q3).
- i18n: dictionary vi/en tách khỏi component, mặc định tiếng Việt, chuyển đổi giữ context (nguồn: Q4).
- Ops: `GET /api/health` (check DB), script backup/restore, rehearsal checklist 2 máy, seed `TestTrace Self-Test` idempotent (nguồn: Q5, Q6).
- Không thêm framework ngoài spec; không sửa migration cũ.

## Testing Decisions

- Seams đã chốt: evaluator thuần, gate API, CSV reports, i18n, ops, E2E assurance.
- Truth table/rule boundaries cho từng luật; YAML schema test; missing-data → INDETERMINATE test; snapshot bất biến test (evaluate 2 lần cùng kết quả).
- Query fixture + reconciliation KPI vs drill-down; snapshot nội dung CSV.
- E2E: publish gate → evaluate Fail → drill-down → run mới → evaluate Pass → export.
- Setup rehearsal trên máy cả 2 thành viên; migration from empty; backup-restore drill.

## Out of Scope

- Adapter mới, generator mới (xong Slice 3–4).
- PDF export, decision table/state/pairwise UI, AI (đợt sau).
- Invitation flow (gap cũ, ticket riêng nếu cần).

## Further Notes

- Mọi mục có nguồn từ plan hoặc Q Slice 6; E2E-06 và review mới là căn cứ.
- Chưa publish GitHub; tiến độ tick trong `docs/spec/slice-6-tickets.md` sau khi chia ticket.
- Bước tiếp theo: `to-tickets` chia Slice 6.
