// Neutral CFG IR v0 (nguồn: plan M11 + Q2 Slice 3).
// Chỉ khái niệm dùng chung; chi tiết riêng ngôn ngữ nằm ở metadata.

export type CfgNodeType =
  'ENTRY' | 'EXIT' | 'BASIC_BLOCK' | 'DECISION' | 'MERGE' | 'LOOP' | 'RETURN' | 'THROW' | 'CALL';

export type CfgEdgeType = 'NORMAL' | 'TRUE' | 'FALSE' | 'CASE' | 'EXCEPTION' | 'LOOP_BACK';

export interface SourceRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CfgNode {
  id: string;
  type: CfgNodeType;
  label?: string;
  sourceRange?: SourceRange;
  metadata?: Record<string, unknown>;
}

export interface CfgEdge {
  id: string;
  from: string;
  to: string;
  type: CfgEdgeType;
  label?: string;
}

export interface NeutralCfg {
  nodes: CfgNode[];
  edges: CfgEdge[];
}

function fail(code: string, message: string): never {
  throw Object.assign(new Error(message), { code });
}

export interface CfgGraph extends NeutralCfg {
  addNode: (input: Omit<CfgNode, 'id'>) => CfgNode;
  addEdge: (input: Omit<CfgEdge, 'id'>) => CfgEdge;
}

export function createGraph(): CfgGraph {
  const nodes: CfgNode[] = [];
  const edges: CfgEdge[] = [];
  let nodeSeq = 0;
  let edgeSeq = 0;
  return {
    nodes,
    edges,
    addNode(input) {
      nodeSeq += 1;
      const node: CfgNode = { ...input, id: `n${nodeSeq}` };
      nodes.push(node);
      return node;
    },
    addEdge(input) {
      const known = new Set(nodes.map((n) => n.id));
      if (!known.has(input.from) || !known.has(input.to)) {
        fail('CFG_EDGE_UNKNOWN_NODE', 'Edge trỏ tới node không tồn tại');
      }
      edgeSeq += 1;
      const edge: CfgEdge = { ...input, id: `e${edgeSeq}` };
      edges.push(edge);
      return edge;
    },
  };
}
