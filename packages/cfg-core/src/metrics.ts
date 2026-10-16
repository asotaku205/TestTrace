// Metrics: complexity, decision points, basis paths v0 (nguồn: plan M11 + CFG-03).
// Paths là simple path ENTRY→EXIT (không lặp node), chặn ở ngưỡng maxPaths.
// Đây là xấp xỉ v0 cho test generation Slice 4, không phải tập basis đầy đủ.
import type { NeutralCfg } from './graph.js';

export function complexity(graph: NeutralCfg): number {
  return graph.edges.length - graph.nodes.length + 2;
}

export function decisionPoints(graph: NeutralCfg): string[] {
  return graph.nodes.filter((n) => n.type === 'DECISION' || n.type === 'LOOP').map((n) => n.id);
}

export interface BasisPathsResult {
  paths: string[][];
  truncated: boolean;
}

export function basisPaths(graph: NeutralCfg, maxPaths = 200): BasisPathsResult {
  const entries = graph.nodes.filter((n) => n.type === 'ENTRY').map((n) => n.id);
  const exits = new Set(graph.nodes.filter((n) => n.type === 'EXIT').map((n) => n.id));
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  const paths: string[][] = [];
  let truncated = false;
  const visit = (current: string, trail: string[]): void => {
    if (paths.length >= maxPaths) {
      truncated = true;
      return;
    }
    if (exits.has(current)) {
      paths.push([...trail, current]);
      return;
    }
    for (const next of adjacency.get(current) ?? []) {
      if (trail.includes(next)) continue;
      visit(next, [...trail, current]);
      if (truncated) return;
    }
  };
  for (const entry of entries) {
    visit(entry, []);
    if (truncated) break;
  }
  return { paths, truncated };
}
