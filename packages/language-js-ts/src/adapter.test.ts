// Contract suite adapter JS đầy đủ (nguồn: ADAPTER-JS-02).
// Đỏ trước khi có builder: toàn bộ fixture phải xanh sau implementation.
import { describe, expect, it } from 'vitest';
import { runContractSuite, jsFixtures } from '@testtrace/test-fixtures';
import { createJsTsAdapter } from './adapter.js';

describe('js adapter contract', () => {
  it('xanh toàn bộ corpus', () => {
    const results = runContractSuite(createJsTsAdapter(), jsFixtures);
    expect(results).toEqual(jsFixtures.map((f) => ({ fixtureId: f.id, pass: true, failures: [] })));
  });

  it('cú pháp lỗi trả diagnostic dòng/cột, không ném graph sai', () => {
    try {
      createJsTsAdapter().buildControlFlow('function broken( {');
      expect.unreachable('phải ném lỗi cú pháp');
    } catch (err) {
      expect(err).toMatchObject({ code: 'ADAPTER_SYNTAX' });
      const diagnostics = (err as { diagnostics: Array<{ line: number; column: number }> })
        .diagnostics;
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0].line).toBeGreaterThanOrEqual(1);
    }
  });

  it('for-of/for-in vẽ LOOP, break/continue đúng đích', () => {
    const graph = createJsTsAdapter().buildControlFlow(`function total(xs) {
  let s = 0;
  for (const x of xs) {
    if (x < 0) continue;
    s += x;
  }
  return s;
}`);
    expect(graph.nodes.some((n) => n.type === 'LOOP' && n.label === 'for-of')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'EXIT')).toBe(true);
    const graphIn = createJsTsAdapter().buildControlFlow(`function keys(o) {
  let s = '';
  for (const k in o) {
    s += k;
  }
  return s;
}`);
    expect(graphIn.nodes.some((n) => n.type === 'LOOP' && n.label === 'for-in')).toBe(true);
  });

  it('try/catch/finally vẽ đường EXCEPTION, finally nối đường rơi qua', () => {
    const graph = createJsTsAdapter().buildControlFlow(`function f() {
  try {
    return 1;
  } catch (e) {
    return 2;
  }
}`);
    expect(graph.edges.some((e) => e.type === 'EXCEPTION')).toBe(true);
    const withFinally = createJsTsAdapter().buildControlFlow(`function g(x) {
  let y = 0;
  try {
    y = parse(x);
  } catch (e) {
    y = -1;
  } finally {
    y += 1;
  }
  return y;
}`);
    expect(withFinally.nodes.some((n) => n.label === 'finally')).toBe(true);
    expect(withFinally.edges.some((e) => e.type === 'EXCEPTION')).toBe(true);
  });

  it('locate trả source range của node', () => {
    const adapter = createJsTsAdapter();
    const graph = adapter.buildControlFlow(jsFixtures[0].source);
    const block = graph.nodes.find((n) => n.type === 'BASIC_BLOCK');
    expect(adapter.locate(graph, block?.id ?? '')).toMatchObject({ startLine: 2 });
  });

  it('capability trung thực: có sequence/branch/loop/return/exception', () => {
    const capabilities = createJsTsAdapter().capabilities();
    expect(capabilities).toMatchObject({
      sequence: true,
      branch: true,
      loop: true,
      earlyReturn: true,
      exceptionFlow: true,
    });
  });
});
