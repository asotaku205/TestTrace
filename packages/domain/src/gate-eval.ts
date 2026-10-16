// Evaluator gate thuần trên snapshot (nguồn: plan M17 + GATE-02).
// Thiếu dữ liệu → INDETERMINATE. Cùng snapshot cho cùng kết quả.
import type { GateRules } from './gate.js';

export interface GateSnapshot {
  uncoveredHighRisk: number;
  openBlockerCritical: number;
  staleCount: number;
  passRate: number | null;
  maxComplexity: number | null;
}

export type RuleStatus = 'PASS' | 'FAIL' | 'INDETERMINATE';

export interface RuleResult {
  rule: string;
  status: RuleStatus;
  expected?: unknown;
  actual?: unknown;
  reason?: string;
}

export interface GateEvaluation {
  verdict: 'PASS' | 'FAIL' | 'INDETERMINATE';
  results: RuleResult[];
}

export function evaluateGate(rules: GateRules, snapshot: GateSnapshot): GateEvaluation {
  const results: RuleResult[] = [];
  if (rules.uncovered_high_risk_requirements !== undefined) {
    results.push({
      rule: 'uncovered_high_risk_requirements',
      status:
        snapshot.uncoveredHighRisk <= rules.uncovered_high_risk_requirements ? 'PASS' : 'FAIL',
      expected: rules.uncovered_high_risk_requirements,
      actual: snapshot.uncoveredHighRisk,
    });
  }
  if (rules.open_critical_defects !== undefined) {
    results.push({
      rule: 'open_critical_defects',
      status: snapshot.openBlockerCritical <= rules.open_critical_defects ? 'PASS' : 'FAIL',
      expected: rules.open_critical_defects,
      actual: snapshot.openBlockerCritical,
    });
  }
  if (rules.stale_tests_for_changed_code !== undefined) {
    results.push({
      rule: 'stale_tests_for_changed_code',
      status: snapshot.staleCount <= rules.stale_tests_for_changed_code ? 'PASS' : 'FAIL',
      expected: rules.stale_tests_for_changed_code,
      actual: snapshot.staleCount,
    });
  }
  if (rules.pass_rate_min !== undefined) {
    results.push(
      snapshot.passRate === null
        ? { rule: 'pass_rate_min', status: 'INDETERMINATE', reason: 'Thiếu dữ liệu pass rate' }
        : {
            rule: 'pass_rate_min',
            status: snapshot.passRate >= rules.pass_rate_min ? 'PASS' : 'FAIL',
            expected: rules.pass_rate_min,
            actual: snapshot.passRate,
          },
    );
  }
  if (rules.max_complexity !== undefined) {
    results.push(
      snapshot.maxComplexity === null
        ? { rule: 'max_complexity', status: 'INDETERMINATE', reason: 'Thiếu dữ liệu complexity' }
        : {
            rule: 'max_complexity',
            status: snapshot.maxComplexity <= rules.max_complexity ? 'PASS' : 'FAIL',
            expected: rules.max_complexity,
            actual: snapshot.maxComplexity,
          },
    );
  }
  if (rules.branch_coverage_min !== undefined) {
    results.push({
      rule: 'branch_coverage_min',
      status: 'INDETERMINATE',
      reason: 'Chưa có dữ liệu branch coverage ở Slice 6',
    });
  }
  if (rules.required_suites !== undefined) {
    results.push({
      rule: 'required_suites',
      status: 'INDETERMINATE',
      reason: 'Chưa có khái niệm suite bắt buộc ở Slice 6',
    });
  }
  const verdict = results.some((r) => r.status === 'FAIL')
    ? 'FAIL'
    : results.some((r) => r.status === 'INDETERMINATE')
      ? 'INDETERMINATE'
      : 'PASS';
  return { verdict, results };
}
