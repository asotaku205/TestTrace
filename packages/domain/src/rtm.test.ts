// Test truth table RTM: UNCOVERED > STALE > AT_RISK > TRUSTED (nguồn: RTM-01).
import { describe, expect, it } from 'vitest';
import { deriveRtmStatus } from './rtm.js';

describe('deriveRtmStatus', () => {
  it('không test active thì UNCOVERED + NO_TEST', () => {
    expect(
      deriveRtmStatus({ hasActiveTest: false, codeChanged: true, hasFail: true, hasSevereDefect: true }),
    ).toEqual({ status: 'UNCOVERED', reasonCodes: ['NO_TEST'] });
  });

  it('code đổi sau run thì STALE + CODE_CHANGED', () => {
    expect(
      deriveRtmStatus({ hasActiveTest: true, codeChanged: true, hasFail: false, hasSevereDefect: false }),
    ).toEqual({ status: 'STALE', reasonCodes: ['CODE_CHANGED'] });
  });

  it('Fail hoặc defect nặng thì AT_RISK', () => {
    expect(
      deriveRtmStatus({ hasActiveTest: true, codeChanged: false, hasFail: true, hasSevereDefect: false }),
    ).toEqual({ status: 'AT_RISK', reasonCodes: ['FAIL_OPEN'] });
    expect(
      deriveRtmStatus({ hasActiveTest: true, codeChanged: false, hasFail: false, hasSevereDefect: true }),
    ).toEqual({ status: 'AT_RISK', reasonCodes: ['DEFECT_OPEN'] });
  });

  it('đủ bảo vệ thì TRUSTED không reason', () => {
    expect(
      deriveRtmStatus({ hasActiveTest: true, codeChanged: false, hasFail: false, hasSevereDefect: false }),
    ).toEqual({ status: 'TRUSTED', reasonCodes: [] });
  });
});
