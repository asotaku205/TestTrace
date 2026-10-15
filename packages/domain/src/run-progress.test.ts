// Progress run tính realtime từ items (nguồn: M06 + RUN-02 invariant).
// Run rỗng trả percent null (không phải 100%).
import { describe, expect, it } from 'vitest';
import { runProgress } from './run-progress.js';

describe('runProgress', () => {
  it('run rỗng thì percent null', () => {
    expect(runProgress([])).toEqual({ done: 0, total: 0, percent: null });
  });

  it('đếm done trên tổng thực tế', () => {
    expect(runProgress([true, true, false, false])).toEqual({
      done: 2,
      total: 4,
      percent: 50,
    });
  });

  it('100% chỉ khi mọi item đều done', () => {
    expect(runProgress([true, true]).percent).toBe(100);
    expect(runProgress([true, false]).percent).toBe(50);
  });
});
