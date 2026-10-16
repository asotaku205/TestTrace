// Engine BVA: điểm biên/sát biên/đại diện cho miền đóng-mở (nguồn: plan M05 + DESIGN-BVA-01).
export interface BvaDomain {
  type: 'integer' | 'float';
  min: number;
  max: number;
  minInclusive: boolean;
  maxInclusive: boolean;
  step?: number;
}

export type BvaPointKind =
  'valid-min' | 'valid-max' | 'just-below-min' | 'just-above-max' | 'representative';

export interface BvaPoint {
  value: number;
  kind: BvaPointKind;
  valid: boolean;
}

export function bvaPoints(domain: BvaDomain): BvaPoint[] {
  if (!(domain.min < domain.max)) {
    throw Object.assign(new Error('Miền BVA cần min < max'), { code: 'BVA_RANGE' });
  }
  const step = domain.step ?? 1;
  if (!(step > 0)) {
    throw Object.assign(new Error('Step BVA phải > 0'), { code: 'BVA_RANGE' });
  }
  const validMin = domain.minInclusive ? domain.min : domain.min + step;
  const validMax = domain.maxInclusive ? domain.max : domain.max - step;
  const mid = validMin + (validMax - validMin) / 2;
  return [
    { value: validMin, kind: 'valid-min', valid: true },
    { value: validMax, kind: 'valid-max', valid: true },
    { value: validMin - step, kind: 'just-below-min', valid: false },
    { value: validMax + step, kind: 'just-above-max', valid: false },
    { value: mid, kind: 'representative', valid: true },
  ];
}
