// Schema luật quality gate v0 (nguồn: plan M17 + GATE-01).
// branch_coverage_min và required_suites hợp lệ ở schema nhưng evaluator
// trả INDETERMINATE vì thiếu dữ liệu (nguồn: Q1 Slice 6).

export interface GateRules {
  uncovered_high_risk_requirements?: number;
  open_critical_defects?: number;
  stale_tests_for_changed_code?: number;
  pass_rate_min?: number;
  max_complexity?: number;
  branch_coverage_min?: number;
  required_suites?: string[];
}

const INTEGER_RULES = [
  'uncovered_high_risk_requirements',
  'open_critical_defects',
  'stale_tests_for_changed_code',
] as const;

export function validateGateRules(input: unknown): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, errors: ['Rules phải là object'] };
  }
  const rules = input as Record<string, unknown>;
  const known = new Set([
    ...INTEGER_RULES,
    'pass_rate_min',
    'max_complexity',
    'branch_coverage_min',
    'required_suites',
  ]);
  for (const key of Object.keys(rules)) {
    if (!known.has(key)) errors.push(`Rule không hỗ trợ: ${key}`);
  }
  for (const key of INTEGER_RULES) {
    const value = rules[key];
    if (value !== undefined && (!Number.isInteger(value) || (value as number) < 0)) {
      errors.push(`${key} phải là số nguyên >= 0`);
    }
  }
  const passRate = rules['pass_rate_min'];
  if (passRate !== undefined && (typeof passRate !== 'number' || passRate < 0 || passRate > 100)) {
    errors.push('pass_rate_min phải trong 0–100');
  }
  const maxComplexity = rules['max_complexity'];
  if (
    maxComplexity !== undefined &&
    (!Number.isInteger(maxComplexity) || (maxComplexity as number) < 1)
  ) {
    errors.push('max_complexity phải là số nguyên >= 1');
  }
  const branch = rules['branch_coverage_min'];
  if (branch !== undefined && (typeof branch !== 'number' || branch < 0 || branch > 100)) {
    errors.push('branch_coverage_min phải trong 0–100');
  }
  const suites = rules['required_suites'];
  if (
    suites !== undefined &&
    (!Array.isArray(suites) || !suites.every((s) => typeof s === 'string'))
  ) {
    errors.push('required_suites phải là mảng string');
  }
  return { ok: errors.length === 0, errors };
}
