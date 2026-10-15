// Transition release (nguồn: M03 + REL-01).
// DRAFT → IN_TEST → PASSED|FAILED; FAILED được quay lại IN_TEST;
// PASSED → RELEASED → ARCHIVED. Không có đường tắt.
import { describe, expect, it } from 'vitest';
import { canReleaseTransition, type ReleaseStatus } from './release.js';

describe('canReleaseTransition', () => {
  it('đi đúng luồng chính', () => {
    expect(canReleaseTransition('DRAFT', 'IN_TEST')).toBe(true);
    expect(canReleaseTransition('IN_TEST', 'PASSED')).toBe(true);
    expect(canReleaseTransition('IN_TEST', 'FAILED')).toBe(true);
    expect(canReleaseTransition('PASSED', 'RELEASED')).toBe(true);
    expect(canReleaseTransition('RELEASED', 'ARCHIVED')).toBe(true);
  });

  it('FAILED được quay lại IN_TEST', () => {
    expect(canReleaseTransition('FAILED', 'IN_TEST')).toBe(true);
  });

  it('chặn nhảy cóc và quay lui', () => {
    const bad: Array<[ReleaseStatus, ReleaseStatus]> = [
      ['DRAFT', 'RELEASED'],
      ['IN_TEST', 'ARCHIVED'],
      ['PASSED', 'IN_TEST'],
      ['RELEASED', 'IN_TEST'],
      ['ARCHIVED', 'DRAFT'],
    ];
    for (const [from, to] of bad) expect(canReleaseTransition(from, to)).toBe(false);
  });
});
