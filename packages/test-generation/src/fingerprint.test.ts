// Test fingerprint draft: cùng nội dung thì trùng (kể cả khác nguồn), input đổi thì khác (nguồn: DRAFT-01).
import { describe, expect, it } from 'vitest';
import { draftFingerprint } from './fingerprint.js';

const base = {
  technique: 'branch',
  inputs: { x: 1 },
  expectedResult: '0',
};

describe('draftFingerprint', () => {
  it('thứ tự key không ảnh hưởng', () => {
    expect(draftFingerprint({ ...base, inputs: { x: 1 } })).toBe(
      draftFingerprint({ technique: 'branch', inputs: { x: 1 }, expectedResult: '0' }),
    );
  });

  it('input đổi thì fingerprint khác (reject cũ không chặn draft mới)', () => {
    expect(draftFingerprint(base)).not.toBe(draftFingerprint({ ...base, inputs: { x: 2 } }));
  });

  it('technique khác thì fingerprint khác', () => {
    expect(draftFingerprint(base)).not.toBe(draftFingerprint({ ...base, technique: 'path' }));
  });

  it('expected khác thì fingerprint khác', () => {
    expect(draftFingerprint(base)).not.toBe(draftFingerprint({ ...base, expectedResult: '1' }));
  });
});
