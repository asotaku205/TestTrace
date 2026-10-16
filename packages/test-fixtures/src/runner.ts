// Contract runner: chạy fixture qua adapter bất kỳ, assert bất biến đồ thị.
// Không snapshot JSON; công thức complexity tính trực tiếp M = E - N + 2P.
import type { LanguageAdapter, NeutralCfg } from '@testtrace/cfg-core';
import type { CfgFixture } from './fixtures.js';

export interface FixtureResult {
  fixtureId: string;
  pass: boolean;
  failures: string[];
}

function summarize(graph: NeutralCfg): {
  nodes: number;
  edges: number;
  decisions: number;
  complexity: number;
} {
  const decisions = graph.nodes.filter((n) => n.type === 'DECISION' || n.type === 'LOOP').length;
  const complexity = graph.edges.length - graph.nodes.length + 2;
  return { nodes: graph.nodes.length, edges: graph.edges.length, decisions, complexity };
}

export function assertFixture(adapter: LanguageAdapter, fixture: CfgFixture): FixtureResult {
  const graph = adapter.buildControlFlow(fixture.source);
  const actual = summarize(graph);
  const failures: string[] = [];
  (Object.keys(fixture.expected) as Array<keyof typeof actual>).forEach((key) => {
    if (actual[key] !== fixture.expected[key]) {
      failures.push(`${key}: expected ${fixture.expected[key]}, got ${actual[key]}`);
    }
  });
  return { fixtureId: fixture.id, pass: failures.length === 0, failures };
}

export function runContractSuite(
  adapter: LanguageAdapter,
  fixtures: CfgFixture[],
): FixtureResult[] {
  return fixtures.map((fixture) => assertFixture(adapter, fixture));
}
