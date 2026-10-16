// Validator graph: entry/exit, tham chiếu edge, unreachable đánh dấu không tự xóa.
// (nguồn: plan M11 + CFG-02). Unreachable không làm invalid.
import type { NeutralCfg } from './graph.js';

export type ValidationIssueCode = 'UNKNOWN_NODE' | 'MISSING_ENTRY' | 'MISSING_EXIT';

export interface ValidationIssue {
  code: ValidationIssueCode;
  message: string;
  nodeId?: string;
  edgeId?: string;
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  unreachable: string[];
}

export function validateGraph(graph: NeutralCfg): ValidationResult {
  const issues: ValidationIssue[] = [];
  const known = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) {
      issues.push({
        code: 'UNKNOWN_NODE',
        message: `Edge ${edge.id} trỏ tới node không tồn tại`,
        edgeId: edge.id,
      });
    }
  }
  const entries = graph.nodes.filter((n) => n.type === 'ENTRY');
  if (entries.length === 0) {
    issues.push({ code: 'MISSING_ENTRY', message: 'Graph thiếu ENTRY' });
  }
  const exits = graph.nodes.filter((n) => n.type === 'EXIT');
  if (exits.length === 0) {
    issues.push({ code: 'MISSING_EXIT', message: 'Graph thiếu EXIT' });
  }
  const reachable = new Set<string>();
  const queue = entries.map((n) => n.id);
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!known.has(edge.from) || !known.has(edge.to)) continue;
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  while (queue.length > 0) {
    const current = queue.pop() as string;
    if (reachable.has(current)) continue;
    reachable.add(current);
    for (const next of adjacency.get(current) ?? []) {
      if (!reachable.has(next)) queue.push(next);
    }
  }
  const unreachable = graph.nodes.map((n) => n.id).filter((id) => !reachable.has(id));
  return { valid: issues.length === 0, issues, unreachable };
}
