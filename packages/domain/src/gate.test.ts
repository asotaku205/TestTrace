// Test schema luật gate (nguồn: GATE-01).
// Chỉ kiểm tra hình dạng + biên; đánh giá thuộc GATE-02.
import { describe, expect, it } from 'vitest';
import { validateGateRules } from './gate.js';

describe('validateGateRules', () => {
  it('rules hợp lệ thì ok', () => {
    expect(
      validateGateRules({
        uncovered_high_risk_requirements: 0,
        open_critical_defects: 0,
        pass_rate_min: 80,
      }),
    ).toEqual({ ok: true, errors: [] });
  });

  it('rule lạ thì báo lỗi', () => {
    const result = validateGateRules({ luat_la: 1 });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('luat_la'))).toBe(true);
  });

  it('giá trị ngoài biên thì báo lỗi', () => {
    expect(validateGateRules({ pass_rate_min: 101 }).ok).toBe(false);
    expect(validateGateRules({ pass_rate_min: -1 }).ok).toBe(false);
    expect(validateGateRules({ uncovered_high_risk_requirements: -1 }).ok).toBe(false);
    expect(validateGateRules({ max_complexity: 0 }).ok).toBe(false);
  });

  it('không phải object thì báo lỗi', () => {
    expect(validateGateRules(null).ok).toBe(false);
    expect(validateGateRules([]).ok).toBe(false);
  });
});
