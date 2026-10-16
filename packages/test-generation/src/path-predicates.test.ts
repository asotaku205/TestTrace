// Test trích predicates từ path CFG + source (nguồn: GEN-PATH-01).
// Engine theo luật: đọc condition qua sourceRange, không suy luận symbolic.
import { describe, expect, it } from 'vitest';
import { createGraph } from '@testtrace/cfg-core';
import { predicatesForPath } from './path-predicates.js';

const SOURCE = `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`;

function branchGraph() {
  const graph = createGraph();
  const entry = graph.addNode({ type: 'ENTRY' });
  const dec = graph.addNode({
    type: 'DECISION',
    sourceRange: { startLine: 2, startColumn: 6, endLine: 2, endColumn: 17 },
  });
  const r1 = graph.addNode({ type: 'RETURN' });
  const r2 = graph.addNode({ type: 'RETURN' });
  const exit = graph.addNode({ type: 'EXIT' });
  const e0 = graph.addEdge({ from: entry.id, to: dec.id, type: 'NORMAL' });
  const e1 = graph.addEdge({ from: dec.id, to: r1.id, type: 'TRUE' });
  const e2 = graph.addEdge({ from: dec.id, to: r2.id, type: 'FALSE' });
  const e3 = graph.addEdge({ from: r1.id, to: exit.id, type: 'NORMAL' });
  const e4 = graph.addEdge({ from: r2.id, to: exit.id, type: 'NORMAL' });
  return { graph, entry, dec, r1, r2, exit, e0, e1, e2, e3, e4 };
}

describe('predicatesForPath', () => {
  it('path qua TRUE ghi điều kiện đúng', () => {
    const { graph, entry, dec, r1, exit } = branchGraph();
    const predicates = predicatesForPath(graph, SOURCE, [entry.id, dec.id, r1.id, exit.id]);
    expect(predicates).toEqual(['if `total > 100` is true']);
  });

  it('path qua FALSE ghi điều kiện sai', () => {
    const { graph, entry, dec, r2, exit } = branchGraph();
    const predicates = predicatesForPath(graph, SOURCE, [entry.id, dec.id, r2.id, exit.id]);
    expect(predicates).toEqual(['if `total > 100` is false']);
  });

  it('node không có range thì ghi nhận thiếu điều kiện', () => {
    const { graph, entry, dec } = branchGraph();
    const noRange = graph.addNode({ type: 'DECISION' });
    const predicates = predicatesForPath(graph, SOURCE, [entry.id, dec.id, noRange.id]);
    expect(predicates.some((p) => p.includes('unknown'))).toBe(true);
  });
});
