// Graph viewer: SVG + highlight source + filter edge + path explorer + export (nguồn: VIEW-01).
// Layout BFS từ @testtrace/cfg-core; tọa độ chỉ ảnh hưởng hiển thị.
import { useMemo, useRef, useState } from 'react';
import { layoutGraph, type CfgEdge, type CfgNode, type SourceRange } from '@testtrace/cfg-core';
import { t } from './i18n.js';
import { useLang } from './lang.js';

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

import { authHeaders, apiFetch } from './lib/api.js';

export function CfgViewer({
  graph,
  source,
  paths,
  meta,
  projectId,
  analysisId,
}: {
  graph: ViewerGraph;
  source: string;
  paths: string[][];
  meta: { adapterId: string; adapterVersion: string };
  projectId?: string;
  analysisId?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [showException, setShowException] = useState(true);
  const [showLoopBack, setShowLoopBack] = useState(true);
  const [pathIndex, setPathIndex] = useState<number | null>(null);
  const [generated, setGenerated] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const lang = useLang();

  async function generate(kind: 'path' | 'branch'): Promise<void> {
    if (!projectId || !analysisId) return;
    setGenerated(null);
    const body =
      kind === 'path' && pathIndex !== null && paths[pathIndex]
        ? { analysisId, path: paths[pathIndex] }
        : kind === 'branch' && selected
          ? { analysisId, nodeId: selected }
          : null;
    if (!body) {
      setGenerated(t(lang, 'viewer', 'pickFirst'));
      return;
    }
    const res = await apiFetch(`/api/projects/${projectId}/drafts/from-${kind}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json()) as { code?: string };
      setGenerated(`Error: ${err.code ?? res.status}`);
      return;
    }
    const draft = (await res.json()) as { id: string; deduped?: boolean };
    setGenerated(
      draft.deduped
        ? `${t(lang, 'viewer', 'generatedHave')}: ${draft.id}`
        : `${t(lang, 'viewer', 'generatedNew')}: ${draft.id}`,
    );
  }

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

  // Trích dòng code liên quan nhất từ sourceRange để hiện lên node
  function codeSnippet(n: CfgNode): string {
    const r = n.sourceRange;
    if (!r) return n.label || n.type;
    const rangeLines = lines
      .slice(r.startLine - 1, r.endLine)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
    if (rangeLines.length === 0) return n.label || n.type;
    // Ưu tiên dòng chứa từ khóa theo loại node
    let pick = rangeLines[0];
    if (n.type === 'DECISION') {
      pick = rangeLines.find((l) => /^(if|else if|while|for|switch|case)\b/.test(l)) ?? rangeLines[0];
    } else if (n.type === 'RETURN') {
      pick = rangeLines.find((l) => l.startsWith('return')) ?? rangeLines[0];
    } else if (n.type === 'ENTRY') {
      pick = rangeLines.find((l) => /function|=>|\(.*\)\s*\{/.test(l)) ?? rangeLines[0];
    }
    const clean = pick.replace(/\s+/g, ' ').trim();
    return clean.length > 28 ? clean.slice(0, 27) + '…' : clean;
  }

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
            <option value="">{t(lang, 'viewer', 'all')}</option>
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
        </button>{' '}
        {projectId && analysisId && (
          <>
            <button type="button" onClick={() => void generate('path')}>
              {t(lang, 'viewer', 'genPath')}
            </button>{' '}
            <button type="button" onClick={() => void generate('branch')}>
              {t(lang, 'viewer', 'genNode')}
            </button>
          </>
        )}
        {generated && <p role="status">{generated}</p>}
      </div>
      <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8 }}>
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
                  x1={from.x + 95}
                  y1={from.y + 48}
                  x2={to.x + 95}
                  y2={to.y}
                  stroke={hot ? '#d32f2f' : '#555'}
                  strokeWidth={hot ? 3 : 1.5}
                  markerEnd="url(#arrow)"
                />
                <text x={(from.x + to.x) / 2 + 97} y={(from.y + to.y) / 2 + 24} fontSize="10">
                  {e.type === 'NORMAL' ? '' : e.type}
                </text>
              </g>
            );
          })}
          {graph.nodes.map((n) => {
            const pos = layout.positions.get(n.id);
            if (!pos) return null;
            const hot = selected === n.id || activePath.includes(n.id);
            const snippet = codeSnippet(n);
            return (
              <g key={n.id} data-node-id={n.id} data-node-type={n.type}>
                <rect
                  x={pos.x}
                  y={pos.y}
                  width="190"
                  height="48"
                  rx="8"
                  fill={NODE_COLORS[n.type] ?? '#eee'}
                  stroke={hot ? '#d32f2f' : '#333'}
                  strokeWidth={hot ? 3 : 1}
                  onClick={() => setSelected(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <title>{`${snippet} (${n.type}${
                    n.sourceRange
                      ? `, ${t(lang, 'viewer', 'lines')} ${n.sourceRange.startLine}-${n.sourceRange.endLine}`
                      : `, ${t(lang, 'viewer', 'noSourceRange')}`
                  })`}</title>
                </rect>
                <text
                  x={pos.x + 95}
                  y={pos.y + 20}
                  fontSize="11"
                  fontFamily="monospace"
                  textAnchor="middle"
                  onClick={() => setSelected(n.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {snippet}
                </text>
                <text
                  x={pos.x + 95}
                  y={pos.y + 36}
                  fontSize="9"
                  fill="#555"
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
        <pre style={{ background: '#f5f5f5', color: '#171717', padding: 12, maxHeight: 480, overflow: 'auto', minWidth: 280, flexShrink: 0, borderRadius: 8, fontSize: 13 }}>
          {lines.map((line, i) => {
            const lineNo = i + 1;
            const hot =
              selectedRange !== null &&
              lineNo >= selectedRange.startLine &&
              lineNo <= selectedRange.endLine;
            return (
              <div key={lineNo} style={{ background: hot ? '#fff176' : undefined, color: '#171717' }}>
                <span style={{ color: '#a3a3a3', marginRight: 8 }}>{lineNo}</span>{line}
              </div>
            );
          })}
        </pre>
      </div>
      {!graph.nodes.some((n) => n.sourceRange) && <p>{t(lang, 'viewer', 'noRange')}</p>}
    </div>
  );
}
