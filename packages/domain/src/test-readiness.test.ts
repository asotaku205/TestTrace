// Rule READY cho test case (nguồn: M04 + TEST-01):
// READY cần expected result và (ít nhất 1 requirement link hoặc lý do độc lập).
import { describe, expect, it } from 'vitest';
import { readinessGaps } from './test-readiness.js';

describe('readinessGaps', () => {
  it('đủ expected + link thì không còn gap', () => {
    expect(
      readinessGaps({ expectedResult: 'Thấy tổng tiền', linkCount: 1, independentReason: null }),
    ).toEqual([]);
  });

  it('đủ expected + lý do độc lập thì không còn gap', () => {
    expect(
      readinessGaps({ expectedResult: 'X', linkCount: 0, independentReason: 'Smoke test độc lập' }),
    ).toEqual([]);
  });

  it('thiếu expected thì báo gap', () => {
    expect(readinessGaps({ expectedResult: '', linkCount: 2, independentReason: null })).toEqual([
      'EXPECTED_RESULT',
    ]);
  });

  it('không link và không lý do thì báo gap', () => {
    expect(readinessGaps({ expectedResult: 'X', linkCount: 0, independentReason: '  ' })).toEqual([
      'REQUIREMENT_LINK',
    ]);
  });

  it('thiếu cả hai thì báo cả hai gap', () => {
    expect(readinessGaps({ expectedResult: '', linkCount: 0, independentReason: null })).toEqual([
      'EXPECTED_RESULT',
      'REQUIREMENT_LINK',
    ]);
  });
});
