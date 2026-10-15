// State machine defect (nguồn: plan M07 + BUG-01).
import type { ProjectRole } from './permissions.js';

export type DefectStatus =
  | 'NEW'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'FIXED'
  | 'RETEST'
  | 'CLOSED'
  | 'REOPENED'
  | 'REJECTED';

const next: Record<DefectStatus, DefectStatus[]> = {
  NEW: ['TRIAGED', 'REJECTED'],
  TRIAGED: ['ASSIGNED', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['FIXED'],
  FIXED: ['RETEST'],
  RETEST: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED'],
  CLOSED: [],
  REJECTED: [],
};

const doers: Record<ProjectRole, DefectStatus[]> = {
  OWNER: [
    'TRIAGED',
    'ASSIGNED',
    'IN_PROGRESS',
    'FIXED',
    'RETEST',
    'CLOSED',
    'REOPENED',
    'REJECTED',
  ],
  MANAGER: [
    'TRIAGED',
    'ASSIGNED',
    'IN_PROGRESS',
    'FIXED',
    'RETEST',
    'CLOSED',
    'REOPENED',
    'REJECTED',
  ],
  TESTER: ['IN_PROGRESS', 'FIXED', 'RETEST', 'CLOSED', 'REOPENED'],
  VIEWER: [],
};

export function canDefectTransition(from: DefectStatus, to: DefectStatus): boolean {
  return next[from].includes(to);
}

export function rolesForDefectTransition(from: DefectStatus, to: DefectStatus): ProjectRole[] {
  if (!canDefectTransition(from, to)) return [];
  const roles: ProjectRole[] = ['OWNER', 'MANAGER', 'TESTER', 'VIEWER'];
  return roles.filter((role) => doers[role].includes(to));
}
