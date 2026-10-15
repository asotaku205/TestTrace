// State machine defect + vai trò từng transition (nguồn: M07 + BUG-01).
import { describe, expect, it } from 'vitest';
import {
  canDefectTransition,
  rolesForDefectTransition,
  type DefectStatus,
} from './defect-machine.js';

describe('canDefectTransition', () => {
  it('đi đúng luồng chính', () => {
    const flow: Array<[DefectStatus, DefectStatus]> = [
      ['NEW', 'TRIAGED'],
      ['TRIAGED', 'ASSIGNED'],
      ['ASSIGNED', 'IN_PROGRESS'],
      ['IN_PROGRESS', 'FIXED'],
      ['FIXED', 'RETEST'],
      ['RETEST', 'CLOSED'],
    ];
    for (const [from, to] of flow) expect(canDefectTransition(from, to)).toBe(true);
  });

  it('RETEST fail thì REOPENED rồi về ASSIGNED', () => {
    expect(canDefectTransition('RETEST', 'REOPENED')).toBe(true);
    expect(canDefectTransition('REOPENED', 'ASSIGNED')).toBe(true);
  });

  it('NEW/TRIAGED được REJECTED; CLOSED và REJECTED là terminal', () => {
    expect(canDefectTransition('NEW', 'REJECTED')).toBe(true);
    expect(canDefectTransition('TRIAGED', 'REJECTED')).toBe(true);
    expect(canDefectTransition('CLOSED', 'REOPENED')).toBe(false);
    expect(canDefectTransition('REJECTED', 'ASSIGNED')).toBe(false);
  });

  it('chặn nhảy cóc', () => {
    expect(canDefectTransition('NEW', 'FIXED')).toBe(false);
    expect(canDefectTransition('ASSIGNED', 'CLOSED')).toBe(false);
  });
});

describe('rolesForDefectTransition', () => {
  it('triage và assign chỉ OWNER/MANAGER', () => {
    expect(rolesForDefectTransition('NEW', 'TRIAGED')).toEqual(['OWNER', 'MANAGER']);
    expect(rolesForDefectTransition('TRIAGED', 'ASSIGNED')).toEqual(['OWNER', 'MANAGER']);
  });

  it('CLOSED không cho VIEWER', () => {
    expect(rolesForDefectTransition('RETEST', 'CLOSED')).not.toContain('VIEWER');
  });
});
