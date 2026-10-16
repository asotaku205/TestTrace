// Test validator graph (nguồn: CFG-02).
// Seam: validateGraph. Bắt edge sai, thiếu entry/exit, unreachable được đánh dấu (không invalid).
import { describe, expect, it } from 'vitest';
import { createGraph } from './graph.js';
import { validateGraph } from './validate.js';

describe('validateGraph', () => {
  it('graph tuần tự hợp lệ, không unreachable', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const block = graph.addNode({ type: 'BASIC_BLOCK' });
    const exit = graph.addNode({ type: 'EXIT' });
    graph.addEdge({ from: entry.id, to: block.id, type: 'NORMAL' });
    graph.addEdge({ from: block.id, to: exit.id, type: 'NORMAL' });
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.unreachable).toEqual([]);
  });

  it('thiếu ENTRY thì invalid', () => {
    const graph = createGraph();
    const block = graph.addNode({ type: 'BASIC_BLOCK' });
    const exit = graph.addNode({ type: 'EXIT' });
    graph.addEdge({ from: block.id, to: exit.id, type: 'NORMAL' });
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_ENTRY')).toBe(true);
  });

  it('thiếu EXIT thì invalid', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const block = graph.addNode({ type: 'BASIC_BLOCK' });
    graph.addEdge({ from: entry.id, to: block.id, type: 'NORMAL' });
    const result = validateGraph(graph);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.code === 'MISSING_EXIT')).toBe(true);
  });

  it('node không tới được thì unreachable nhưng vẫn valid', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const exit = graph.addNode({ type: 'EXIT' });
    const dead = graph.addNode({ type: 'BASIC_BLOCK', label: 'chet' });
    graph.addEdge({ from: entry.id, to: exit.id, type: 'NORMAL' });
    const result = validateGraph(graph);
    expect(result.valid).toBe(true);
    expect(result.unreachable).toEqual([dead.id]);
  });
});
