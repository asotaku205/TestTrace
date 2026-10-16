// Test metrics + basis paths (nguồn: CFG-03).
// Seam: complexity/decisionPoints/basisPaths. Path là simple path ENTRY→EXIT, chặn ở ngưỡng.
import { describe, expect, it } from 'vitest';
import { createGraph } from './graph.js';
import { basisPaths, complexity, decisionPoints } from './metrics.js';

function branchGraph() {
  const graph = createGraph();
  const entry = graph.addNode({ type: 'ENTRY' });
  const dec = graph.addNode({ type: 'DECISION' });
  const r1 = graph.addNode({ type: 'RETURN' });
  const r2 = graph.addNode({ type: 'RETURN' });
  const exit = graph.addNode({ type: 'EXIT' });
  graph.addEdge({ from: entry.id, to: dec.id, type: 'NORMAL' });
  graph.addEdge({ from: dec.id, to: r1.id, type: 'TRUE' });
  graph.addEdge({ from: dec.id, to: r2.id, type: 'FALSE' });
  graph.addEdge({ from: r1.id, to: exit.id, type: 'NORMAL' });
  graph.addEdge({ from: r2.id, to: exit.id, type: 'NORMAL' });
  return { graph, entry, exit };
}

describe('complexity', () => {
  it('tuần tự M = 1, một nhánh M = 2', () => {
    expect(complexity(branchGraph().graph)).toBe(2);
  });
});

describe('decisionPoints', () => {
  it('liệt kê DECISION và LOOP', () => {
    const { graph } = branchGraph();
    const loop = graph.addNode({ type: 'LOOP' });
    expect(decisionPoints(graph).length).toBe(2);
    expect(decisionPoints(graph)).toContain(loop.id);
  });
});

describe('basisPaths', () => {
  it('một nhánh cho đúng 2 paths tới EXIT', () => {
    const { graph, entry, exit } = branchGraph();
    const result = basisPaths(graph);
    expect(result.truncated).toBe(false);
    expect(result.paths.length).toBe(2);
    for (const path of result.paths) {
      expect(path[0]).toBe(entry.id);
      expect(path[path.length - 1]).toBe(exit.id);
    }
  });

  it('vượt ngưỡng thì dừng và báo truncated', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const exit = graph.addNode({ type: 'EXIT' });
    let previous = entry.id;
    for (let i = 0; i < 10; i += 1) {
      const dec = graph.addNode({ type: 'DECISION' });
      const merge = graph.addNode({ type: 'MERGE' });
      graph.addEdge({ from: previous, to: dec.id, type: 'NORMAL' });
      graph.addEdge({ from: dec.id, to: merge.id, type: 'TRUE' });
      graph.addEdge({ from: dec.id, to: merge.id, type: 'FALSE' });
      previous = merge.id;
    }
    graph.addEdge({ from: previous, to: exit.id, type: 'NORMAL' });
    const result = basisPaths(graph, 200);
    expect(result.truncated).toBe(true);
    expect(result.paths.length).toBe(200);
  });
});
