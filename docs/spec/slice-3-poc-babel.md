# PoC Babel parser (ADAPTER-JS-01) — tiêu chí viết trước khi chạy

Nguồn: guardrails duyệt breakdown Slice 3 + Q1 (location chính xác + hỗ trợ TS).

## Điều kiện Q1 cần kiểm chứng

1. Location chính xác: range/loc của statement map đúng dòng/cột để highlight.
2. Hỗ trợ TS: parse được function có type annotation mà không cần config riêng.

## Tiêu chí FAIL (định trước)

- Không lấy được source range chính xác từng statement, hoặc
- Phải hack để walk AST (dùng regex tiền xử lý, đoán node bằng string matching), hoặc
- Quá timebox ~1 ngày chưa ra IR đúng cho 1 hàm mẫu.

## Fallback

Fail thì quay lại Q1 đánh giá parser khác (typescript compiler API, acorn). Chữ "chính thức" có răng.

## Verdict: PASS — chọn Babel chính thức

Ngày: 2026-10-16. Chạy trong ~1 giờ, dưới timebox.

- Location chính xác: range statement map đúng dòng/cột (test `parse được type annotation TS và range map đúng dòng` xanh).
- Hỗ trợ TS: function có annotation parse không cần config riêng ngoài plugin `typescript`.
- Không trigger tiêu chí fail nào: không regex, không hack walk AST (dùng trực tiếp `FunctionDeclaration`/`Statement` của `@babel/types`).
- Contract fixture `js-sequential` xanh qua runner CFG-04.
- Quyết định: Babel là parser chính thức cho ADAPTER-JS-02. Capability branch/loop/return mở ở ticket đó; try/catch đã defer theo breakdown.
