// Contract suite adapter Python (nguồn: ADAPTER-PY-01).
import { describe, expect, it } from 'vitest';
import { runContractSuite, pyFixtures, pyNegativeFixtures } from '@testtrace/test-fixtures';
import { createPythonAdapter } from './adapter.js';

describe('python adapter contract', () => {
  it('xanh toàn bộ corpus Python (4 fixture)', () => {
    const results = runContractSuite(createPythonAdapter(), pyFixtures);
    expect(results).toEqual(pyFixtures.map((f) => ({ fixtureId: f.id, pass: true, failures: [] })));
  });

  it('syntax-error và try/except trả đúng kind có dòng/cột', () => {
    for (const negative of pyNegativeFixtures) {
      try {
        createPythonAdapter().buildControlFlow(negative.source);
        expect.unreachable(`phải ném lỗi cho ${negative.id}`);
      } catch (err) {
        const thrown = err as { code: string; diagnostics: Array<{ line: number; kind: string }> };
        expect(thrown.diagnostics[0].line).toBeGreaterThanOrEqual(1);
        if (negative.kind === 'syntax-error') expect(thrown.code).toBe('ADAPTER_SYNTAX');
        else expect(thrown.code).toBe('ADAPTER_UNSUPPORTED');
      }
    }
  });

  it('locate trả source range của node', () => {
    const adapter = createPythonAdapter();
    const graph = adapter.buildControlFlow(pyFixtures[0].source);
    const block = graph.nodes.find((n) => n.type === 'BASIC_BLOCK');
    expect(adapter.locate(graph, block?.id ?? '')).toMatchObject({ startLine: 2 });
  });

  it('đổi tên biến/format không đổi cấu trúc (metamorphic)', () => {
    const adapter = createPythonAdapter();
    const a = adapter.buildControlFlow(pyFixtures[1].source);
    const renamed = `def fee(amount):
    if amount > 100:
        return 0
    else:
        return 5`;
    const b = adapter.buildControlFlow(renamed);
    expect([b.nodes.length, b.edges.length]).toEqual([a.nodes.length, a.edges.length]);
  });

  it('capability trung thực', () => {
    expect(createPythonAdapter().capabilities()).toMatchObject({
      sequence: true,
      branch: true,
      loop: true,
      earlyReturn: true,
      exceptionFlow: false,
    });
  });
});
