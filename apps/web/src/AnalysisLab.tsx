// UI tối thiểu phân tích CFG: nhập source, xem metrics/diagnostics (nguồn: ANALYSIS-01).
// Vẽ graph thuộc VIEW-01.
import { useCallback, useEffect, useState } from 'react';
import { CfgViewer } from './CfgViewer.js';

interface AnalysisSummary {
  id: string;
  name: string | null;
  language: string;
  status: string;
  adapterId: string;
  adapterVersion: string;
  createdAt: string;
}

interface AnalysisDetail extends AnalysisSummary {
  diagnostics: Array<{ kind: string; message: string }> | null;
  source: string;
  graph: { nodes: Array<{ id: string; type: string }>; edges: Array<never> } | null;
  metrics: {
    complexity: number;
    decisions: number;
    paths: string[][];
    pathsTruncated: boolean;
    unreachable: string[];
  } | null;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function AnalysisLab({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [language, setLanguage] = useState('typescript');
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<AnalysisDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/projects/${projectId}/analyses`, { headers: headers() });
    if (res.ok) setItems((await res.json()) as AnalysisSummary[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function analyze(): Promise<void> {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/analyses`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ language, source }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { code?: string };
      setError(body.code ?? `HTTP ${res.status}`);
      return;
    }
    setSource('');
    await reload();
  }

  async function openAnalysis(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}/analyses/${id}`, { headers: headers() });
    if (res.ok) setSelected((await res.json()) as AnalysisDetail);
  }

  return (
    <div>
      <h4>Analysis Lab</h4>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        <option value="typescript">TypeScript</option>
        <option value="javascript">JavaScript</option>
      </select>
      <textarea
        value={source}
        onChange={(e) => setSource(e.target.value)}
        placeholder="Dán function cần phân tích"
        rows={6}
        cols={60}
      />
      <button type="button" onClick={() => void analyze()}>
        Phân tích
      </button>
      <ul>
        {items.map((a) => (
          <li key={a.id}>
            <button type="button" onClick={() => void openAnalysis(a.id)}>
              {a.name ?? a.id.slice(0, 8)} [{a.status}] {a.language}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <p>
            Trạng thái: {selected.status} | Adapter: {selected.adapterId} {selected.adapterVersion}
          </p>
          {selected.metrics && (
            <p>
              Complexity: {selected.metrics.complexity} | Decisions: {selected.metrics.decisions}
              {selected.metrics.pathsTruncated && ' (paths đã cắt bớt)'}
            </p>
          )}
          {selected.graph && (
            <p>
              Nodes: {selected.graph.nodes.length} | Edges: {selected.graph.edges.length}
            </p>
          )}
          {(selected.diagnostics ?? []).length > 0 && (
            <ul>
              {(selected.diagnostics ?? []).map((d, i) => (
                <li key={i}>
                  [{d.kind}] {d.message}
                </li>
              ))}
            </ul>
          )}
          {selected.graph && selected.metrics && (
            <CfgViewer
              graph={selected.graph as never}
              source={selected.source}
              paths={selected.metrics.paths}
              meta={{ adapterId: selected.adapterId, adapterVersion: selected.adapterVersion }}
            />
          )}
        </div>
      )}
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
