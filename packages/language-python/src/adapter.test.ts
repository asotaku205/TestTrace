// Contract suite adapter Python (nguồn: ADAPTER-PY-01).
import { describe, expect, it } from 'vitest';
import { runContractSuite, pyFixtures, pyNegativeFixtures } from '@testtrace/test-fixtures';
import { createPythonAdapter } from './adapter.js';

describe('python adapter contract', () => {
  it('xanh toàn bộ corpus Python (4 fixture)', () => {
    const results = runContractSuite(createPythonAdapter(), pyFixtures);
    expect(results).toEqual(pyFixtures.map((f) => ({ fixtureId: f.id, pass: true, failures: [] })));
  });

  it('syntax-error và cú pháp chưa hỗ trợ trả đúng kind có dòng/cột', () => {
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

  it('ENTRY trỏ tới câu lệnh đầu tiên, không phải dòng def', () => {
    const graph = createPythonAdapter().buildControlFlow(`def fee(total):
    if total > 100:
        return total * 0.9
    return total`);
    const entry = graph.nodes.find((n) => n.type === 'ENTRY');
    expect(entry?.sourceRange).toMatchObject({ startLine: 2, endLine: 3 });
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

  it('try/except/finally, match và loop-else vẽ đúng', () => {
    const adapter = createPythonAdapter();
    const tried = adapter.buildControlFlow(`def f(x):
    try:
        y = int(x)
    except ValueError:
        y = -1
    finally:
        y += 1
    return y`);
    expect(tried.nodes.some((n) => n.label === 'finally')).toBe(true);
    expect(tried.edges.some((e) => e.type === 'EXCEPTION')).toBe(true);
    const matched = adapter.buildControlFlow(`def label(n):
    match n:
        case 1:
            return 'one'
        case _:
            return 'other'`);
    expect(matched.nodes.some((n) => n.type === 'DECISION' && n.label === 'match')).toBe(true);
    const loopElse = adapter.buildControlFlow(`def find(xs, t):
    for x in xs:
        if x == t:
            break
    else:
        return -1
    return 0`);
    expect(loopElse.nodes.some((n) => n.label === 'loop-else')).toBe(true);
  });

  it('capability trung thực', () => {
    expect(createPythonAdapter().capabilities()).toMatchObject({
      sequence: true,
      branch: true,
      loop: true,
      earlyReturn: true,
      exceptionFlow: true,
    });
  });
});
