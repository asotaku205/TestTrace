// Layout graph theo lớp BFS từ ENTRY (nguồn: VIEW-01).
// Chỉ tính tọa độ hiển thị; không làm đổi graph.
import type { NeutralCfg } from './graph.js';

export interface NodePosition {
  x: number;
  y: number;
}

export interface GraphLayout {
  positions: Map<string, NodePosition>;
  width: number;
  height: number;
}

const COLUMN_WIDTH = 240;
const ROW_HEIGHT = 96;

export function layoutGraph(graph: NeutralCfg): GraphLayout {
  const adjacency = new Map<string, string[]>();
  for (const edge of graph.edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  const depth = new Map<string, number>();
  const queue: string[] = [];
  for (const node of graph.nodes) {
    if (node.type === 'ENTRY') {
      depth.set(node.id, 0);
      queue.push(node.id);
    }
  }
  while (queue.length > 0) {
    const current = queue.shift() as string;
    const currentDepth = depth.get(current) as number;
    for (const next of adjacency.get(current) ?? []) {
      if (!depth.has(next)) {
        depth.set(next, currentDepth + 1);
        queue.push(next);
      }
    }
  }
  let maxDepth = 0;
  for (const node of graph.nodes) {
    if (!depth.has(node.id)) {
      maxDepth += 1;
      depth.set(node.id, maxDepth);
    } else {
      maxDepth = Math.max(maxDepth, depth.get(node.id) as number);
    }
  }
  const columns = new Map<number, number>();
  const positions = new Map<string, NodePosition>();
  for (const node of graph.nodes) {
    const column = depth.get(node.id) as number;
    const row = columns.get(column) ?? 0;
    columns.set(column, row + 1);
    positions.set(node.id, { x: column * COLUMN_WIDTH + 20, y: row * ROW_HEIGHT + 20 });
  }
  return {
    positions,
    width: (maxDepth + 1) * COLUMN_WIDTH + 40,
    height: Math.max(...columns.values(), 1) * ROW_HEIGHT + 40,
  };
}
