// Test builder NeutralCfg (nguồn: CFG-01).
// Seam: createGraph/addNode/addEdge. Bắt edge trỏ node không tồn tại;
// validation sâu (entry/exit/unreachable) thuộc CFG-02.
import { describe, expect, it } from 'vitest';
import { createGraph } from './graph.js';

describe('graph builder', () => {
  it('dựng graph tuần tự entry → block → exit', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const block = graph.addNode({
      type: 'BASIC_BLOCK',
      label: 'x = 1',
      sourceRange: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 6 },
    });
    const exit = graph.addNode({ type: 'EXIT' });
    graph.addEdge({ from: entry.id, to: block.id, type: 'NORMAL' });
    graph.addEdge({ from: block.id, to: exit.id, type: 'NORMAL' });
    expect(graph.nodes.length).toBe(3);
    expect(graph.edges.length).toBe(2);
    expect(new Set(graph.nodes.map((n) => n.id)).size).toBe(3);
  });

  it('edge trỏ node không tồn tại thì ném CFG_EDGE_UNKNOWN_NODE', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    expect(() => graph.addEdge({ from: entry.id, to: 'khong-co', type: 'NORMAL' })).toThrowError(
      expect.objectContaining({ code: 'CFG_EDGE_UNKNOWN_NODE' }),
    );
  });

  it('id ổn định và tăng dần trong cùng graph', () => {
    const graph = createGraph();
    const a = graph.addNode({ type: 'ENTRY' });
    const b = graph.addNode({ type: 'EXIT' });
    expect(a.id).not.toBe(b.id);
    const e1 = graph.addEdge({ from: a.id, to: b.id, type: 'NORMAL' });
    const e2 = graph.addEdge({ from: a.id, to: b.id, type: 'TRUE' });
    expect(e1.id).not.toBe(e2.id);
  });
});
