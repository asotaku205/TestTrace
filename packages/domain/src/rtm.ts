// Truth table RTM, ưu tiên UNCOVERED > STALE > AT_RISK > TRUSTED (nguồn: RTM-01).
export type RtmStatus = 'UNCOVERED' | 'STALE' | 'AT_RISK' | 'TRUSTED';

export type RtmReasonCode = 'NO_TEST' | 'CODE_CHANGED' | 'FAIL_OPEN' | 'DEFECT_OPEN';

export interface RtmSignals {
  hasActiveTest: boolean;
  codeChanged: boolean;
  hasFail: boolean;
  hasSevereDefect: boolean;
}

export function deriveRtmStatus(signals: RtmSignals): {
  status: RtmStatus;
  reasonCodes: RtmReasonCode[];
} {
  if (!signals.hasActiveTest) return { status: 'UNCOVERED', reasonCodes: ['NO_TEST'] };
  if (signals.codeChanged) return { status: 'STALE', reasonCodes: ['CODE_CHANGED'] };
  const reasons: RtmReasonCode[] = [];
  if (signals.hasFail) reasons.push('FAIL_OPEN');
  if (signals.hasSevereDefect) reasons.push('DEFECT_OPEN');
  if (reasons.length > 0) return { status: 'AT_RISK', reasonCodes: reasons };
  return { status: 'TRUSTED', reasonCodes: [] };
}
