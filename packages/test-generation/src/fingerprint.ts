// Fingerprint draft: hash chuẩn hóa technique + inputs + expected (nguồn: DRAFT-01).
// sourceRef KHÔNG nằm trong key: cùng nội dung từ nhiều nguồn thì gộp, giữ mảng sources.
// Input đổi → fingerprint khác → reject cũ không chặn draft mới.
import { stableHash } from '@testtrace/domain';

export interface DraftFingerprintInput {
  technique: string;
  inputs: unknown;
  expectedResult?: string | null;
}

export function draftFingerprint(input: DraftFingerprintInput): string {
  return stableHash({
    technique: input.technique,
    inputs: input.inputs,
    expectedResult: input.expectedResult ?? null,
  });
}
