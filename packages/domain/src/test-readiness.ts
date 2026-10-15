// Rule READY (nguồn: plan M04 + TEST-01).
export interface ReadinessInput {
  expectedResult: string | null;
  linkCount: number;
  independentReason: string | null;
}

export type ReadinessGap = 'EXPECTED_RESULT' | 'REQUIREMENT_LINK';

export function readinessGaps(input: ReadinessInput): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  if (!input.expectedResult || input.expectedResult.trim().length === 0) {
    gaps.push('EXPECTED_RESULT');
  }
  const hasLink = input.linkCount > 0;
  const hasReason = !!input.independentReason && input.independentReason.trim().length > 0;
  if (!hasLink && !hasReason) {
    gaps.push('REQUIREMENT_LINK');
  }
  return gaps;
}
