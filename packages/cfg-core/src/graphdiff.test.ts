// Test graph diff: added/removed/modified + delta, rename/format không nhiễu (nguồn: DIFF-02).
import { describe, expect, it } from 'vitest';
import { createGraph } from './graph.js';
import { diffGraphs } from './graphdiff.js';

const OLD_SOURCE = `function fee(total) {
  if (total > 100) {
    return 0;
  } else {
    return 5;
  }
}`;

function branchGraph(range = { startLine: 2, startColumn: 6, endLine: 2, endColumn: 17 }) {
  const graph = createGraph();
  const entry = graph.addNode({ type: 'ENTRY' });
  const dec = graph.addNode({
    type: 'DECISION',
    sourceRange: range,
  });
  const r1 = graph.addNode({ type: 'RETURN' });
  const r2 = graph.addNode({ type: 'RETURN' });
  const exit = graph.addNode({ type: 'EXIT' });
  graph.addEdge({ from: entry.id, to: dec.id, type: 'NORMAL' });
  graph.addEdge({ from: dec.id, to: r1.id, type: 'TRUE' });
  graph.addEdge({ from: dec.id, to: r2.id, type: 'FALSE' });
  graph.addEdge({ from: r1.id, to: exit.id, type: 'NORMAL' });
  graph.addEdge({ from: r2.id, to: exit.id, type: 'NORMAL' });
  return graph;
}

describe('diffGraphs', () => {
  it('cùng source thì diff rỗng, delta 0', () => {
    const diff = diffGraphs(
      { graph: branchGraph(), source: OLD_SOURCE },
      { graph: branchGraph(), source: OLD_SOURCE },
    );
    expect(diff.addedNodes).toEqual([]);
    expect(diff.removedNodes).toEqual([]);
    expect(diff.modifiedNodes).toEqual([]);
    expect(diff.complexityDelta).toBe(0);
  });

  it('đổi điều kiện thì DECISION modified', () => {
    const changed = `function fee(total) {
  if (total >= 100) {
    return 0;
  } else {
    return 5;
  }
}`;
    const diff = diffGraphs(
      { graph: branchGraph(), source: OLD_SOURCE },
      { graph: branchGraph(), source: changed },
    );
    expect(diff.modifiedNodes.map((m) => m.change)).toContain('condition');
    expect(diff.addedNodes).toEqual([]);
  });

  it('đổi tên biến + format không tạo impact cấu trúc', () => {
    const renamed = `function fee(amount) {
  if (amount > 100) {
    return 0;
  } else {
    return 5;
  }
}`;
    const other = branchGraph({ startLine: 2, startColumn: 6, endLine: 2, endColumn: 18 });
    const diff = diffGraphs(
      { graph: branchGraph(), source: OLD_SOURCE },
      { graph: other, source: renamed },
    );
    expect(diff.modifiedNodes).toEqual([]);
    expect(diff.addedNodes).toEqual([]);
    expect(diff.removedNodes).toEqual([]);
  });

  it('thêm nhánh thì có added nodes và delta dương', () => {
    const bigger = branchGraph();
    const extra = bigger.addNode({ type: 'DECISION' });
    const exit = bigger.nodes.find((n) => n.type === 'EXIT');
    const r1 = bigger.nodes.find((n) => n.type === 'RETURN');
    if (exit && r1) {
      bigger.addEdge({ from: r1.id, to: extra.id, type: 'NORMAL' });
      bigger.addEdge({ from: extra.id, to: exit.id, type: 'TRUE' });
    }
    const diff = diffGraphs(
      { graph: branchGraph(), source: OLD_SOURCE },
      { graph: bigger, source: OLD_SOURCE },
    );
    expect(diff.addedNodes.length).toBe(1);
    expect(diff.addedEdges.length).toBe(2);
    expect(diff.complexityDelta).toBe(1);
  });
});
