// Graph diff chuẩn hóa: added/removed/modified + delta complexity (nguồn: DIFF-02).
// Matching node theo id (adapter sinh id ổn định theo thứ tự lowering).
// Condition so sau chuẩn hóa (bỏ identifier + collapse space) nên rename/format không nhiễu.
// Đây là heuristic v0 đã ghi nhận, không phải so AST đầy đủ.
import { complexity } from './metrics.js';
import type { NeutralCfg } from './graph.js';

export interface ModifiedNode {
  id: string;
  change: 'condition' | 'type';
}

export interface GraphDiff {
  addedNodes: string[];
  removedNodes: string[];
  modifiedNodes: ModifiedNode[];
  addedEdges: string[];
  removedEdges: string[];
  complexityDelta: number;
}

export interface VersionedGraph {
  graph: NeutralCfg;
  source: string;
}

function sliceAt(
  source: string,
  range: { startLine: number; startColumn: number; endLine: number; endColumn: number } | undefined,
): string {
  if (!range) return '';
  const lines = source.split('\n');
  if (range.startLine === range.endLine) {
    return (lines[range.startLine - 1] ?? '').slice(range.startColumn, range.endColumn);
  }
  return lines.slice(range.startLine - 1, range.endLine).join('\n');
}

export function normalizeCondition(text: string): string {
  return text
    .replace(/[A-Za-z_$][\w$]*/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function diffGraphs(oldVersion: VersionedGraph, newVersion: VersionedGraph): GraphDiff {
  const oldNodes = new Map(oldVersion.graph.nodes.map((n) => [n.id, n]));
  const newNodes = new Map(newVersion.graph.nodes.map((n) => [n.id, n]));
  const addedNodes = [...newNodes.keys()].filter((id) => !oldNodes.has(id));
  const removedNodes = [...oldNodes.keys()].filter((id) => !newNodes.has(id));
  const modifiedNodes: ModifiedNode[] = [];
  for (const [id, oldNode] of oldNodes) {
    const newNode = newNodes.get(id);
    if (!newNode) continue;
    if (oldNode.type !== newNode.type) {
      modifiedNodes.push({ id, change: 'type' });
      continue;
    }
    if (oldNode.type === 'DECISION' || oldNode.type === 'LOOP') {
      const before = normalizeCondition(sliceAt(oldVersion.source, oldNode.sourceRange));
      const after = normalizeCondition(sliceAt(newVersion.source, newNode.sourceRange));
      if (before !== after) modifiedNodes.push({ id, change: 'condition' });
    }
  }
  const edgeKey = (from: string, to: string, type: string): string => `${from}->${to}:${type}`;
  const oldEdges = new Map(
    oldVersion.graph.edges.map((e) => [e.id, edgeKey(e.from, e.to, e.type)]),
  );
  const newEdges = new Map(
    newVersion.graph.edges.map((e) => [e.id, edgeKey(e.from, e.to, e.type)]),
  );
  const addedEdges: string[] = [];
  const removedEdges: string[] = [];
  for (const [id, key] of newEdges) {
    if (![...oldEdges.values()].includes(key)) addedEdges.push(id);
  }
  for (const [id, key] of oldEdges) {
    if (![...newEdges.values()].includes(key)) removedEdges.push(id);
  }
  return {
    addedNodes,
    removedNodes,
    modifiedNodes,
    addedEdges,
    removedEdges,
    complexityDelta: complexity(newVersion.graph) - complexity(oldVersion.graph),
  };
}
