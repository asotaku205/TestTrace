// Khóa idempotency phân tích: hash ổn định của config (nguồn: M10 + ANALYSIS-01).
// Key sắp xếp để thứ tự field không ảnh hưởng.
import { describe, expect, it } from 'vitest';
import { stableHash } from './analysis-key.js';

describe('stableHash', () => {
  it('thứ tự field không đổi hash', () => {
    expect(stableHash({ a: 1, b: 2 })).toBe(stableHash({ b: 2, a: 1 }));
  });

  it('giá trị khác thì hash khác', () => {
    expect(stableHash({ maxPaths: 200 })).not.toBe(stableHash({ maxPaths: 100 }));
  });

  it('sha256 hex 64 ký tự', () => {
    expect(stableHash({})).toMatch(/^[0-9a-f]{64}$/);
  });
});
