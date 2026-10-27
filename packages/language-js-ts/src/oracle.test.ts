// Runner gợi ý oracle bằng vm sandbox (nguồn: GEN-ORACLE-01).
import { describe, expect, it } from 'vitest';
import { formatTrialValue, jsFunctionParams, runJsFunction } from './oracle.js';

describe('runJsFunction', () => {
  it('trả về giá trị', () => {
    expect(runJsFunction('function fee(total) { if (total > 100) { return total * 0.9; } return total; }', [101])).toEqual({
      outcome: 'returned',
      value: 90.9,
    });
    expect(runJsFunction('function f() { return undefined; }', [])).toEqual({
      outcome: 'returned',
      value: undefined,
    });
  });

  it('ném Error có chủ đích thì giữ làm oracle', () => {
    const r = runJsFunction(
      `function grade(score) { if (score < 0) { throw new Error('Invalid score'); } return 'ok'; }`,
      [-1],
    );
    expect(r).toEqual({ outcome: 'threw', name: 'Error', message: 'Invalid score' });
  });

  it('vòng lặp vô hạn -> unsupported (timeout)', () => {
    const r = runJsFunction('function f() { while (true) {} return 1; }', []);
    expect(r.outcome).toBe('unsupported');
  });

  it('dùng tên ngoài sandbox -> unsupported', () => {
    expect(runJsFunction('function f() { return process.version; }', []).outcome).toBe('unsupported');
    expect(runJsFunction('function f() { return require("fs"); }', []).outcome).toBe('unsupported');
  });

  it('TypeError do đối số sai -> unsupported', () => {
    const r = runJsFunction('function f(o) { return o.missing.deep; }', [0]);
    expect(r.outcome).toBe('unsupported');
  });

  it('không phải FunctionDeclaration hoặc có kiểu TS -> unsupported', () => {
    expect(runJsFunction('const f = (x) => x;', [1]).outcome).toBe('unsupported');
    expect(runJsFunction('function f(x: number): number { return x; }', [1]).outcome).toBe(
      'unsupported',
    );
    expect(runJsFunction('function broken( {', []).outcome).toBe('unsupported');
  });

  it('eval/Function constructor bị chặn', () => {
    const r = runJsFunction('function f() { return eval("1+1"); }', []);
    expect(r.outcome).toBe('unsupported');
  });
});

describe('jsFunctionParams', () => {
  it('lấy tên tham số, từ chối param phức tạp', () => {
    expect(jsFunctionParams('function f(a, b) { return a; }')).toEqual(['a', 'b']);
    expect(jsFunctionParams('function f() { return 1; }')).toEqual([]);
    expect(jsFunctionParams('function f({ a }) { return a; }')).toBeNull();
    expect(jsFunctionParams('function f(...rest) { return rest; }')).toBeNull();
  });
});

describe('formatTrialValue', () => {
  it('định dạng gọn', () => {
    expect(formatTrialValue(0)).toBe('0');
    expect(formatTrialValue('A')).toBe('"A"');
    expect(formatTrialValue(undefined)).toBe('undefined');
    expect(formatTrialValue([1, 2])).toBe('[1,2]');
    expect(formatTrialValue(null)).toBe('null');
  });
});
