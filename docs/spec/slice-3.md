## Problem Statement

Từ góc nhìn Tester: với một hàm nguồn, hiện không thấy được control flow (nhánh, vòng lặp, đường đi), không biết độ phức tạp, không biết test nào phủ nhánh nào — mọi đánh giá coverage đều cảm tính. Nguồn: plan "Slice 3 — Một CFG đúng cho JavaScript/TypeScript" và demo cuối slice (dán hàm, phân tích, xem CFG, complexity, basis paths, highlight source).

## Solution

Từ góc nhìn người dùng: chọn ngôn ngữ, dán/tải mã hàm, hệ thống phân tích tĩnh (không thực thi), trả CFG có node/edge/nhãn nhánh/source range, complexity `M = E - N + 2P`, decision points, unreachable blocks, basis paths trong ngưỡng; click node highlight dòng code; lọc exception/loop edge; export SVG/JSON; lưu analysis gắn version để dùng lại. Nguồn: plan M09–M13 + Q1–Q6 Slice 3.

## User Stories

1. As a Tester, I want dán một hàm JS/TS và nhận CFG trong vài giây, so that thấy control flow thay vì đọc code chay.
2. As a Tester, I want mỗi node cho biết loại (branch/loop/return…) và dòng code tương ứng, so that click node là thấy code.
3. As a Tester, I want xem cyclomatic complexity kèm công thức, so that biết hàm có quá phức tạp không.
4. As a Tester, I want liệt kê decision points và unreachable blocks, so that biết chỗ cần test và code chết.
5. As a Tester, I want xem basis paths trong ngưỡng, so that biết số đường độc lập cần phủ.
6. As a Tester, I want lọc normal/exception/loop-back edge, so that đỡ rối khi graph lớn.
7. As a Tester, I want cú pháp lỗi hoặc chưa hỗ trợ được báo rõ dòng/cột thay vì graph sai lặng lẽ, so that tin được kết quả.
8. As a Tester, I want export SVG/JSON kèm adapter/version/config, so that đưa vào báo cáo.
9. As a Tester, I want phân tích lại cùng input cho cùng graph (idempotent), so that không tốn tài nguyên và kết quả ổn định.
10. As a Manager, I want capability matrix trung thực từng adapter, so that biết ngôn ngữ nào hỗ trợ tới đâu.

## Implementation Decisions

Nguồn chung: plan M09–M13 + Q1–Q6 Slice 3.

- Parser adapter đầu tiên: `@babel/parser` cho JS/TS (PoC trước, chọn chính thức sau PoC). Không regex giả lập parser; không chạy compiler/binary người dùng gửi (nguồn: Q1).
- `NeutralCfg` v0: 9 loại node + 6 loại edge như plan; node mang `sourceRange`; metadata riêng ngôn ngữ không rò vào thuật toán chung; ID ổn định trong cùng analysis (nguồn: Q2).
- 4 fixture đầu: sequential (`M=1`), if/else, loop có break/continue, early return; oracle là node/edge/decision count/complexity/source range, không snapshot JSON (nguồn: Q3).
- Giới hạn: source ≤ 64KB, timeout 10s, nodes ≤ 2000, edges ≤ 4000, paths ≤ 200; vượt ngưỡng trả partial + lý do (nguồn: Q4).
- Contract suite chung trong `packages/test-fixtures` + runner ở `packages/cfg-core`; adapter chỉ công bố khi xanh; UI cảnh báo cú pháp chưa hỗ trợ (nguồn: Q5).
- Thứ tự: JS/TS trước, Python sau khi contract suite ổn định; mỗi adapter một vertical slice (nguồn: Q6).
- Orchestrator: idempotency theo `sourceHash + adapterVersion + configHash`; phân biệt lỗi cú pháp vs unsupported; partial nói rõ phần bỏ qua; không để graph nửa vời khi failure (nguồn: plan M10).
- Metrics: `M = E - N + 2P`; unreachable đánh dấu không tự xóa; path explorer dừng ở ngưỡng (nguồn: plan M11).
- Viewer: layout chỉ đổi tọa độ; graph lớn thu gọn; export ghi adapter/version/config (nguồn: plan M12).
- Không thêm framework ngoài spec (React Flow đã trong stack plan cho viewer).

## Testing Decisions

- Seams đã chốt: (1) cfg-core thuần graph; (2) adapter contract; (3) orchestrator; (4) viewer; (5) persistence analysis.
- Unit algorithm + property invariants (edge trỏ node tồn tại, entry tới được exit, complexity không âm) + metamorphic rename/reformat + golden fixture đã duyệt + mutation cho validator/metrics (nguồn: plan chiến lược kiểm thử).
- Adapter: contract suite + fixture riêng + syntax error + unsupported + source mapping.
- Integration: persistence analysis + idempotency; E2E dán hàm → CFG → highlight → export; performance graph lớn.
- Security: payload quá lớn, timeout, nội dung có ý đồ thực thi không bao giờ chạy.

## Out of Scope

- Adapter Python/Java/C/C++ (Slice 4+; chỉ mở khi gate Slice 3 xanh).
- Test generator từ path (Slice 4); Slice 3 chỉ liệt kê paths.
- Impact diff/RTM/code link (Slice 5).
- AI (M19).

## Further Notes

- Mọi mục có nguồn từ plan hoặc Q Slice 3; chưa gì đúng/hoàn thành, E2E Slice 3 và review mới là căn cứ.
- Điểm dừng bắt buộc giữ nguyên: không mở adapter Python trước khi fixture JS/TS + source mapping + contract suite xanh.
- Bước tiếp theo: `to-tickets` chia Slice 3.
