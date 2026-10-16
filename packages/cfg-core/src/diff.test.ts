// Test ghép units 2 version: same/moved/added/removed (nguồn: DIFF-01).
// Đổi tên cùng params = moved, không phải modified.
import { describe, expect, it } from 'vitest';
import { matchUnits } from './diff.js';

const unit = (name: string, params = 'total') => ({ qualifiedName: name, paramsHash: params });

describe('matchUnits', () => {
  it('cùng tên thì same', () => {
    expect(matchUnits([unit('fee')], [unit('fee')])).toEqual([
      { status: 'same', oldName: 'fee', newName: 'fee' },
    ]);
  });

  it('đổi tên cùng params thì moved', () => {
    expect(matchUnits([unit('fee')], [unit('charge')])).toEqual([
      { status: 'moved', oldName: 'fee', newName: 'charge' },
    ]);
  });

  it('đổi tên khác params thì removed + added', () => {
    expect(matchUnits([unit('fee', 'total')], [unit('charge', 'amount')])).toEqual([
      { status: 'removed', oldName: 'fee', newName: null },
      { status: 'added', oldName: null, newName: 'charge' },
    ]);
  });

  it('no-op: giống hệt thì toàn same', () => {
    expect(
      matchUnits([unit('a'), unit('b')], [unit('a'), unit('b')]).every((m) => m.status === 'same'),
    ).toBe(true);
  });
});
