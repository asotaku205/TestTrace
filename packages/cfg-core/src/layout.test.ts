// Test layout graph: BFS theo depth, node mồ côi ra cột riêng (nguồn: VIEW-01).
// Layout chỉ đổi tọa độ, không đổi graph.
import { describe, expect, it } from 'vitest';
import { createGraph } from './graph.js';
import { layoutGraph } from './layout.js';

describe('layoutGraph', () => {
  it('xếp ENTRY cột 0, node sau sâu hơn', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const block = graph.addNode({ type: 'BASIC_BLOCK' });
    const exit = graph.addNode({ type: 'EXIT' });
    graph.addEdge({ from: entry.id, to: block.id, type: 'NORMAL' });
    graph.addEdge({ from: block.id, to: exit.id, type: 'NORMAL' });
    const layout = layoutGraph(graph);
    expect(layout.positions.get(entry.id)?.x).toBeLessThan(layout.positions.get(block.id)?.x ?? 0);
    expect(layout.positions.get(block.id)?.x).toBeLessThan(layout.positions.get(exit.id)?.x ?? 0);
    expect(layout.width).toBeGreaterThan(0);
    expect(layout.height).toBeGreaterThan(0);
  });

  it('node mồ côi vẫn có tọa độ, không crash', () => {
    const graph = createGraph();
    graph.addNode({ type: 'ENTRY' });
    const orphan = graph.addNode({ type: 'BASIC_BLOCK' });
    const layout = layoutGraph(graph);
    expect(layout.positions.has(orphan.id)).toBe(true);
  });
});
