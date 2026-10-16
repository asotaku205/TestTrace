// Contract suite adapter JS đầy đủ (nguồn: ADAPTER-JS-02).
// Đỏ trước khi có builder: toàn bộ fixture phải xanh sau implementation.
import { describe, expect, it } from 'vitest';
import { runContractSuite, jsFixtures } from '@testtrace/test-fixtures';
import { createJsTsAdapter } from './adapter.js';

describe('js adapter contract', () => {
  it('xanh toàn bộ corpus (5 fixture)', () => {
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

  it('try/catch (defer) trả unsupported có dòng/cột', () => {
    try {
      createJsTsAdapter().buildControlFlow(`function f() {
  try {
    return 1;
  } catch (e) {
    return 2;
  }
}`);
      expect.unreachable('phải ném unsupported');
    } catch (err) {
      expect(err).toMatchObject({ code: 'ADAPTER_UNSUPPORTED' });
    }
  });

  it('locate trả source range của node', () => {
    const adapter = createJsTsAdapter();
    const graph = adapter.buildControlFlow(jsFixtures[0].source);
    const block = graph.nodes.find((n) => n.type === 'BASIC_BLOCK');
    expect(adapter.locate(graph, block?.id ?? '')).toMatchObject({ startLine: 2 });
  });

  it('capability trung thực: có sequence/branch/loop/return, chưa exception', () => {
    const capabilities = createJsTsAdapter().capabilities();
    expect(capabilities).toMatchObject({
      sequence: true,
      branch: true,
      loop: true,
      earlyReturn: true,
      exceptionFlow: false,
    });
  });
});
