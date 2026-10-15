// Transition release (nguồn: plan M03 + REL-01).
export type ReleaseStatus = 'DRAFT' | 'IN_TEST' | 'PASSED' | 'FAILED' | 'RELEASED' | 'ARCHIVED';

const next: Record<ReleaseStatus, ReleaseStatus[]> = {
  DRAFT: ['IN_TEST'],
  IN_TEST: ['PASSED', 'FAILED'],
  FAILED: ['IN_TEST'],
  PASSED: ['RELEASED'],
  RELEASED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canReleaseTransition(from: ReleaseStatus, to: ReleaseStatus): boolean {
  return next[from].includes(to);
}
