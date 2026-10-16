// Graph viewer: SVG + highlight source + filter edge + path explorer + export (nguồn: VIEW-01).
// Layout BFS từ @testtrace/cfg-core; tọa độ chỉ ảnh hưởng hiển thị.
import { useMemo, useRef, useState } from 'react';
import { layoutGraph, type CfgEdge, type CfgNode, type SourceRange } from '@testtrace/cfg-core';

export interface ViewerGraph {
  nodes: CfgNode[];
  edges: CfgEdge[];
}

const NODE_COLORS: Record<string, string> = {
  ENTRY: '#4caf50',
  EXIT: '#f44336',
  BASIC_BLOCK: '#90caf9',
  DECISION: '#fff176',
  MERGE: '#ce93d8',
  LOOP: '#ffab91',
  RETURN: '#a5d6a7',
  THROW: '#ef9a9a',
  CALL: '#80cbc4',
};

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CfgViewer({
  graph,
  source,
  paths,
  meta,
}: {
  graph: ViewerGraph;
  source: string;
  paths: string[][];
  meta: { adapterId: string; adapterVersion: string };
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showException, setShowException] = useState(true);
  const [showLoopBack, setShowLoopBack] = useState(true);
  const [pathIndex, setPathIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const layout = useMemo(() => layoutGraph({ nodes: graph.nodes, edges: graph.edges }), [graph]);
  const lines = useMemo(() => source.split('\n'), [source]);
  const selectedRange: SourceRange | null =
    graph.nodes.find((n) => n.id === selected)?.sourceRange ?? null;
  const activePath = pathIndex !== null ? (paths[pathIndex] ?? []) : [];
  const activeEdges = useMemo(() => {
    const pairs = new Set<string>();
    for (let i = 0; i + 1 < activePath.length; i += 1) {
      pairs.add(`${activePath[i]}->${activePath[i + 1]}`);
    }
    return pairs;
  }, [activePath]);

  const visibleEdges = graph.edges.filter(
    (e) => (e.type !== 'EXCEPTION' || showException) && (e.type !== 'LOOP_BACK' || showLoopBack),
  );

  function exportSvg(): void {
    if (svgRef.current) {
      download('cfg.svg', new XMLSerializer().serializeToString(svgRef.current), 'image/svg+xml');
    }
  }

  function exportJson(): void {
    download(
      'cfg.json',
      JSON.stringify(
        {
          adapter: meta.adapterId,
          version: meta.adapterVersion,
          exportedAt: new Date().toISOString(),
          nodes: graph.nodes.length,
          edges: graph.edges.length,
          graph,
        },
        null,
        2,
      ),
      'application/json',
    );
  }

  return (
    <div>
      <div>
        {Object.entries(NODE_COLORS).map(([type, color]) => (
          <span key={type} style={{ marginRight: 8 }}>
            <span
              style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                background: color,
                marginRight: 4,
              }}
            />
            {type}
          </span>
        ))}
      </div>
      <label>
        <input
          type="checkbox"
          checked={showException}
          onChange={(e) => setShowException(e.target.checked)}
        />
        Exception edges
      </label>
      <label>
        <input
          type="checkbox"
          checked={showLoopBack}
          onChange={(e) => setShowLoopBack(e.target.checked)}
        />
        Loop-back edges
      </label>
      <div>
        <label>
          Path
          <select
            value={pathIndex ?? ''}
            onChange={(e) => setPathIndex(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">Tất cả</option>
            {paths.map((_, i) => (
              <option key={i} value={i}>
                Path {i + 1}
              </option>
            ))}
          </select>
        </label>
        <button type="button" onClick={exportSvg}>
          Export SVG
        </button>{' '}
        <button type="button" onClick={exportJson}>
          Export JSON
        </button>
      </div>
      <div style={{ display: 'flex', gap: 16 }}>
        <svg
          ref={svgRef}
          width={layout.width}
          height={layout.height}
          role="img"
          aria-label="Control flow graph"
        >
          <defs>
            <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8" fill="none" stroke="#555" strokeWidth="1.5" />
            </marker>
          </defs>
          {visibleEdges.map((e) => {
            const from = layout.positions.get(e.from);
            const to = layout.positions.get(e.to);
            if (!from || !to) return null;
            const hot = activeEdges.has(`${e.from}->${e.to}`);
            return (
              <g key={e.id}>
                <line
                  x1={from.x + 50}
                  y1={from.y + 16}
                  x2={to.x + 50}
                  y2={to.y}
                  stroke={hot ? '#d32f2f' : '#555'}
                  strokeWidth={hot ? 3 : 1.5}
                  markerEnd="url(#arrow)"
                />
                <text x={(from.x + to.x) / 2 + 52} y={(from.y + to.y) / 2 + 8} fontSize="10">
                  {e.type === 'NORMAL' ? '' : e.type}
                </text>
              </g>
            );
          })}
          {graph.nodes.map((n) => {
            const pos = layout.positions.get(n.id);
            if (!pos) return null;
            const hot = selected === n.id || activePath.includes(n.id);
            return (
              <g key={n.id}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width="100"
                  height="32"
                  rx="6"
                  fill={NODE_COLORS[n.type] ?? '#eee'}
                  stroke={hot ? '#d32f2f' : '#333'}
                  strokeWidth={hot ? 3 : 1}
                  onClick={() => setSelected(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${n.type}${n.label ? `: ${n.label}` : ''}${
                    n.sourceRange
                      ? ` (dòng ${n.sourceRange.startLine}–${n.sourceRange.endLine})`
                      : ' (không có source range)'
                  }`}</title>
                </rect>
                <text
                  x={pos.x + 50}
                  y={pos.y + 20}
                  fontSize="11"
                  textAnchor="middle"
                  onClick={() => setSelected(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {n.type}
                </text>
              </g>
            );
          })}
        </svg>
        <pre style={{ background: '#f5f5f5', padding: 8, maxHeight: 480, overflow: 'auto' }}>
          {lines.map((line, i) => {
            const lineNo = i + 1;
            const hot =
              selectedRange !== null &&
              lineNo >= selectedRange.startLine &&
              lineNo <= selectedRange.endLine;
            return (
              <div key={lineNo} style={{ background: hot ? '#fff176' : undefined }}>
                {lineNo}: {line}
              </div>
            );
          })}
        </pre>
      </div>
      {!graph.nodes.some((n) => n.sourceRange) && <p>Graph này không có source range để map.</p>}
    </div>
  );
}
