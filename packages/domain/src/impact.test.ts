// Test gán reasonCode impact dùng chung (nguồn: IMPACT-01 + từ vựng Slice 5).
// DIRECT_LINK: test→requirement→unit đổi cấu trúc.
// SAME_REQUIREMENT: test→requirement cùng artifact (lưới rộng hơn).
// PATH_CHANGED dành cho khi có coverage (chưa phát ở ticket này).
import { describe, expect, it } from 'vitest';
import { reasonCodesFor } from './impact.js';

const changed = [{ artifactId: 'a1', qualifiedName: 'fee' }];

describe('reasonCodesFor', () => {
  it('requirement gắn unit đổi cấu trúc thì DIRECT_LINK', () => {
    expect(reasonCodesFor([{ artifactId: 'a1', qualifiedName: 'fee' }], changed)).toEqual([
      'DIRECT_LINK',
    ]);
  });

  it('requirement cùng artifact khác unit thì SAME_REQUIREMENT', () => {
    expect(reasonCodesFor([{ artifactId: 'a1', qualifiedName: 'helper' }], changed)).toEqual([
      'SAME_REQUIREMENT',
    ]);
  });

  it('không liên quan thì rỗng', () => {
    expect(reasonCodesFor([{ artifactId: 'a2', qualifiedName: 'other' }], changed)).toEqual([]);
  });
});
