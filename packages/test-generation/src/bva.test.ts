// Test engine BVA: biên đóng/mở, điểm biên/sát biên/đại diện (nguồn: DESIGN-BVA-01).
import { describe, expect, it } from 'vitest';
import { bvaPoints } from './bva.js';

describe('bvaPoints', () => {
  it('miền đóng [1,10] cho biên hợp lệ 1,10 và sát ngoài 0,11', () => {
    const points = bvaPoints({
      type: 'integer',
      min: 1,
      max: 10,
      minInclusive: true,
      maxInclusive: true,
    });
    const byKind = Object.fromEntries(points.map((p) => [p.kind, p]));
    expect(byKind['valid-min']).toMatchObject({ value: 1, valid: true });
    expect(byKind['valid-max']).toMatchObject({ value: 10, valid: true });
    expect(byKind['just-below-min']).toMatchObject({ value: 0, valid: false });
    expect(byKind['just-above-max']).toMatchObject({ value: 11, valid: false });
    expect(byKind['representative'].valid).toBe(true);
  });

  it('miền mở (1,10) thì biên 1,10 là invalid, biên hợp lệ là 2,9', () => {
    const points = bvaPoints({
      type: 'integer',
      min: 1,
      max: 10,
      minInclusive: false,
      maxInclusive: false,
    });
    const byKind = Object.fromEntries(points.map((p) => [p.kind, p]));
    expect(byKind['valid-min']).toMatchObject({ value: 2, valid: true });
    expect(byKind['valid-max']).toMatchObject({ value: 9, valid: true });
    expect(byKind['just-below-min']).toMatchObject({ value: 1, valid: false });
    expect(byKind['just-above-max']).toMatchObject({ value: 10, valid: false });
  });

  it('min >= max thì ném BVA_RANGE', () => {
    expect(() =>
      bvaPoints({ type: 'integer', min: 10, max: 5, minInclusive: true, maxInclusive: true }),
    ).toThrowError(expect.objectContaining({ code: 'BVA_RANGE' }));
  });
});
