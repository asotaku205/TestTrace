// Solver suy input từ predicates (nguồn: GEN-ORACLE-01).
import { describe, expect, it } from 'vitest';
import { materializeArgs, solvePathInputs } from './oracle.js';

describe('solvePathInputs', () => {
  it('so sánh đơn true/false', () => {
    expect(solvePathInputs(['if `total > 100` is true'])).toEqual({ total: 101 });
    expect(solvePathInputs(['if `total > 100` is false'])).toEqual({ total: 100 });
    expect(solvePathInputs(['if `score < 0` is true'])).toEqual({ score: -1 });
    expect(solvePathInputs(['if `n >= 90` is false'])).toEqual({ n: 89 });
    expect(solvePathInputs(['if `x === 5` is true'])).toEqual({ x: 5 });
    expect(solvePathInputs(['if `x === 5` is false'])).toEqual({ x: 0 });
  });

  it('đảo chiều khi số ở bên trái', () => {
    expect(solvePathInputs(['if `100 < total` is true'])).toEqual({ total: 101 });
    expect(solvePathInputs(['if `0 >= score` is true'])).toEqual({ score: 0 });
  });

  it('gộp nhiều ràng buộc cùng biến', () => {
    expect(solvePathInputs(['if `x > 5` is true', 'if `x < 10` is true'])).toEqual({ x: 6 });
    expect(solvePathInputs(['if `x > 5` is true', 'if `x < 5` is true'])).toBeNull();
    expect(solvePathInputs(['if `x !== 0` is true', 'if `x < 1` is true'])).toEqual({ x: -1 });
  });

  it('độ dài mảng và truthiness', () => {
    expect(solvePathInputs(['if `i < numbers.length` is false'])).toEqual({
      i: 0,
      'numbers.length': 0,
    });
    expect(solvePathInputs(['if `i < numbers.length` is true'])).toEqual({
      i: 0,
      'numbers.length': 1,
    });
    expect(solvePathInputs(['if `a < b` is true', 'if `b === 5` is true'])).toEqual({
      a: 4,
      b: 5,
    });
    expect(solvePathInputs(['if `a < b` is true', 'if `b < a` is true'])).toBeNull();
    expect(solvePathInputs(['if `flag` is true'])).toEqual({ flag: 1 });
    expect(solvePathInputs(['if `flag` is false'])).toEqual({ flag: 0 });
  });

  it('chuỗi và phủ định', () => {
    expect(solvePathInputs(["if `role === 'admin'` is true"])).toEqual({ role: 'admin' });
    expect(solvePathInputs(['if `!(x > 5)` is true'])).toEqual({ x: 5 });
    expect(solvePathInputs(['if `(total > 100)` is true'])).toEqual({ total: 101 });
  });

  it('điều kiện ghép hoặc dạng lạ -> null', () => {
    expect(solvePathInputs(['if `a > 1 && b < 2` is true'])).toBeNull();
    expect(solvePathInputs(['if `x > 1 || x < 0` is true'])).toBeNull();
    expect(solvePathInputs(['if `foo(x)` is true'])).toBeNull();
    expect(solvePathInputs(['if `x > 1` is taken'])).toBeNull();
    expect(solvePathInputs(['không đúng định dạng'])).toBeNull();
  });
});

describe('materializeArgs', () => {
  it('mảng từ .length, mặc định 0', () => {
    expect(materializeArgs(['numbers'], { 'numbers.length': 0 })).toEqual([[]]);
    expect(materializeArgs(['numbers'], { 'numbers.length': 2 })).toEqual([[0, 0]]);
    expect(materializeArgs(['a', 'b'], { b: 7 })).toEqual([0, 7]);
    expect(materializeArgs(['x'], {})).toEqual([0]);
  });
});
