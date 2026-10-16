// Contract runner tham số hóa theo adapter (nguồn: CFG-04).
// Adapter tương lai (Python/Java/C/C++) dùng lại runner này, không sửa runner.
// Không assert snapshot JSON: chỉ N/E/decision/complexity.
import { describe, expect, it } from 'vitest';
import { createGraph, type LanguageAdapter, type NeutralCfg } from '@testtrace/cfg-core';
import { assertFixture, runContractSuite } from './runner.js';
import { jsFixtures } from './fixtures.js';

function stubAdapter(graph: NeutralCfg): LanguageAdapter {
  return {
    id: 'stub',
    versions: ['0'],
    buildControlFlow: () => graph,
    locate: () => null,
    capabilities: () => ({
      sequence: true,
      branch: true,
      loop: true,
      earlyReturn: true,
      exceptionFlow: false,
      asyncGenerator: false,
      preprocessor: false,
    }),
  };
}

describe('assertFixture', () => {
  it('graph khớp oracle thì pass không failures', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const block = graph.addNode({ type: 'BASIC_BLOCK' });
    const ret = graph.addNode({ type: 'RETURN' });
    const exit = graph.addNode({ type: 'EXIT' });
    graph.addEdge({ from: entry.id, to: block.id, type: 'NORMAL' });
    graph.addEdge({ from: block.id, to: ret.id, type: 'NORMAL' });
    graph.addEdge({ from: ret.id, to: exit.id, type: 'NORMAL' });
    const result = assertFixture(stubAdapter(graph), jsFixtures[0]);
    expect(result.pass).toBe(true);
    expect(result.failures).toEqual([]);
  });

  it('graph sai liệt kê đúng trường mismatch', () => {
    const graph = createGraph();
    graph.addNode({ type: 'ENTRY' });
    const result = assertFixture(stubAdapter(graph), jsFixtures[0]);
    expect(result.pass).toBe(false);
    expect(result.failures).toEqual(['nodes: expected 4, got 1', 'edges: expected 3, got 0']);
  });
});

describe('runContractSuite', () => {
  it('chạy mọi fixture qua cùng một adapter', () => {
    const graph = createGraph();
    const entry = graph.addNode({ type: 'ENTRY' });
    const block = graph.addNode({ type: 'BASIC_BLOCK' });
    const ret = graph.addNode({ type: 'RETURN' });
    const exit = graph.addNode({ type: 'EXIT' });
    graph.addEdge({ from: entry.id, to: block.id, type: 'NORMAL' });
    graph.addEdge({ from: block.id, to: ret.id, type: 'NORMAL' });
    graph.addEdge({ from: ret.id, to: exit.id, type: 'NORMAL' });
    const results = runContractSuite(stubAdapter(graph), [jsFixtures[0]]);
    expect(results).toEqual([{ fixtureId: 'js-sequential', pass: true, failures: [] }]);
  });
});
