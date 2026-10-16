// Test evaluator gate thuần trên snapshot (nguồn: GATE-02).
// Thiếu dữ liệu → INDETERMINATE, không tự Pass.
import { describe, expect, it } from 'vitest';
import { evaluateGate } from './gate-eval.js';

describe('evaluateGate', () => {
  it('mọi luật đạt thì PASS', () => {
    const result = evaluateGate(
      { uncovered_high_risk_requirements: 0, open_critical_defects: 0, pass_rate_min: 80 },
      {
        uncoveredHighRisk: 0,
        openBlockerCritical: 0,
        staleCount: 0,
        passRate: 100,
        maxComplexity: 5,
      },
    );
    expect(result.verdict).toBe('PASS');
    expect(result.results.every((r) => r.status === 'PASS')).toBe(true);
  });

  it('một luật rớt thì FAIL kèm actual', () => {
    const result = evaluateGate(
      { open_critical_defects: 0 },
      {
        uncoveredHighRisk: 0,
        openBlockerCritical: 2,
        staleCount: 0,
        passRate: null,
        maxComplexity: null,
      },
    );
    expect(result.verdict).toBe('FAIL');
    expect(result.results[0]).toMatchObject({ status: 'FAIL', actual: 2 });
  });

  it('thiếu dữ liệu thì INDETERMINATE', () => {
    const result = evaluateGate(
      { pass_rate_min: 80, branch_coverage_min: 80 },
      {
        uncoveredHighRisk: 0,
        openBlockerCritical: 0,
        staleCount: 0,
        passRate: null,
        maxComplexity: 9,
      },
    );
    expect(result.verdict).toBe('INDETERMINATE');
    expect(result.results.some((r) => r.status === 'INDETERMINATE')).toBe(true);
  });

  it('biên pass_rate đúng ngưỡng thì PASS', () => {
    const result = evaluateGate(
      { pass_rate_min: 80 },
      {
        uncoveredHighRisk: 0,
        openBlockerCritical: 0,
        staleCount: 0,
        passRate: 80,
        maxComplexity: null,
      },
    );
    expect(result.verdict).toBe('PASS');
  });
});
