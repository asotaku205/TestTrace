// Trích predicates từ path: đọc condition qua sourceRange của DECISION/LOOP (nguồn: GEN-PATH-01).
// Engine theo luật, không symbolic execution: input gợi ý để trống, oracle NEEDS_REVIEW.
import type { NeutralCfg } from '@testtrace/cfg-core';

function sliceSource(
  source: string,
  startLine: number,
  startColumn: number,
  endLine: number,
  endColumn: number,
): string {
  const lines = source.split('\n');
  if (startLine === endLine) {
    return (lines[startLine - 1] ?? '').slice(startColumn, endColumn).trim();
  }
  return lines
    .slice(startLine - 1, endLine)
    .join('\n')
    .trim();
}

export function predicatesForPath(graph: NeutralCfg, source: string, path: string[]): string[] {
  const edgeByPair = new Map<string, string>();
  for (const edge of graph.edges) {
    const key = `${edge.from}->${edge.to}`;
    if (!edgeByPair.has(key)) edgeByPair.set(key, edge.type);
  }
  const predicates: string[] = [];
  for (let i = 0; i < path.length; i += 1) {
    const node = graph.nodes.find((n) => n.id === path[i]);
    if (!node || (node.type !== 'DECISION' && node.type !== 'LOOP')) continue;
    const next = path[i + 1];
    const edgeType = next ? (edgeByPair.get(`${node.id}->${next}`) ?? 'NORMAL') : 'NORMAL';
    const range = node.sourceRange;
    if (!range) {
      predicates.push(`decision ${node.id} has unknown condition`);
      continue;
    }
    const condition = sliceSource(
      source,
      range.startLine,
      range.startColumn,
      range.endLine,
      range.endColumn,
    );
    const taken =
      edgeType === 'TRUE' || edgeType === 'CASE' || edgeType === 'LOOP_BACK'
        ? 'true'
        : edgeType === 'FALSE'
          ? 'false'
          : 'taken';
    predicates.push(`if \`${condition}\` is ${taken}`);
  }
  return predicates;
}
