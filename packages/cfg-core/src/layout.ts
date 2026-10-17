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
  // Layout DỌC: ENTRY ở trên cùng, luồng chảy xuống dưới
  const rows = new Map<number, number>();
  const positions = new Map<string, NodePosition>();
  for (const node of graph.nodes) {
    const level = depth.get(node.id) as number;
    const col = rows.get(level) ?? 0;
    rows.set(level, col + 1);
    positions.set(node.id, { x: col * COLUMN_WIDTH + 20, y: level * ROW_HEIGHT + 20 });
  }
  return {
    positions,
    width: Math.max(...rows.values(), 1) * COLUMN_WIDTH + 40,
    height: (maxDepth + 1) * ROW_HEIGHT + 40,
  };
}
