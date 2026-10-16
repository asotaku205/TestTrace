// Test trích code units JS (nguồn: REG-01).
// Seam: extractUnits trả name + signature (param) ổn định, không phụ thuộc thân hàm.
import { describe, expect, it } from 'vitest';
import { extractUnits } from './units.js';

describe('extractUnits', () => {
  it('trích tên và params function', () => {
    const units = extractUnits(`function fee(total, rate) {
  return total * rate;
}`);
    expect(units).toEqual([{ name: 'fee', signature: 'fee(total,rate)' }]);
  });

  it('cùng tên khác thân thì signature giữ nguyên (để version hóa)', () => {
    const a = extractUnits('function fee(total) {\n  return 0;\n}');
    const b = extractUnits('function fee(total) {\n  return total;\n}');
    expect(a).toEqual(b);
  });

  it('nhiều function thì trích hết theo thứ tự', () => {
    const units = extractUnits('function a() {\n  return 1;\n}\nfunction b(x) {\n  return x;\n}');
    expect(units.map((u) => u.name)).toEqual(['a', 'b']);
  });
});
