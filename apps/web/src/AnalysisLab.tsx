// Analysis Lab: phân tích CFG + sinh test từ mã nguồn (nguồn: ANALYSIS-01, VIEW-01, GEN-PATH-01).
// Nâng cấp: panel diagnostics, path coverage, sinh test biên BVA, toast.
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { FlaskConical, AlertTriangle, CheckCircle2, XCircle, GitBranch, ListChecks } from 'lucide-react';
import { CfgViewer } from './CfgViewer.js';
import { t, type Language } from './i18n.js';
import { useLang } from './lang.js';
import { Button } from './components/ui/button.js';
import { Input } from './components/ui/input.js';
import { Badge } from './components/ui/badge.js';
import { Card, CardHeader, CardTitle } from './components/ui/card.js';

interface AnalysisSummary {
  id: string;
  name: string | null;
  language: string;
  status: string;
  adapterId: string;
  adapterVersion: string;
  createdAt: string;
}

interface Diagnostic {
  kind: string;
  message: string;
  line?: number;
  col?: number;
}

interface AnalysisDetail extends AnalysisSummary {
  diagnostics: Diagnostic[] | null;
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

function statusBadge(status: string) {
  if (status === 'SUCCEEDED') return <Badge variant="success">SUCCEEDED</Badge>;
  if (status === 'PARTIAL') return <Badge variant="warning">PARTIAL</Badge>;
  return <Badge variant="danger">{status}</Badge>;
}

function diagBadge(kind: string) {
  const k = kind.toLowerCase();
  if (k.includes('error') || k.includes('fail')) return <Badge variant="danger">{kind}</Badge>;
  if (k.includes('limit') || k.includes('warn')) return <Badge variant="warning">{kind}</Badge>;
  return <Badge variant="info">{kind}</Badge>;
}

export function AnalysisLab({ projectId, lang: langProp }: { projectId: string; lang?: Language }) {
  const langCtx = useLang();
  const lang = langProp ?? langCtx;
  const [items, setItems] = useState<AnalysisSummary[]>([]);
  const [language, setLanguage] = useState('typescript');
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<AnalysisDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [bvaVar, setBvaVar] = useState('');
  const [bvaMin, setBvaMin] = useState('');
  const [bvaMax, setBvaMax] = useState('');
  const [bvaBusy, setBvaBusy] = useState(false);

  const reload = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/projects/${projectId}/analyses`, { headers: headers() });
    if (res.ok) setItems((await res.json()) as AnalysisSummary[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function analyze(): Promise<void> {
    if (!source.trim() || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/analyses`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ language, source }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { code?: string };
        toast.error(t(lang, 'analysisLab', 'analyze'), { description: body.code ?? `HTTP ${res.status}` });
        return;
      }
      const created = (await res.json()) as { id: string; status: string };
      toast.success(t(lang, 'analysisLab', 'analyzeDone'), {
        description: `${created.status}`,
      });
      setSource('');
      await reload();
      await openAnalysis(created.id);
    } finally {
      setBusy(false);
    }
  }

  async function openAnalysis(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}/analyses/${id}`, { headers: headers() });
    if (res.ok) setSelected((await res.json()) as AnalysisDetail);
  }

  async function draftFromPath(path: string[]): Promise<void> {
    if (!selected) return;
    const res = await fetch(`/api/projects/${projectId}/drafts/from-path`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ analysisId: selected.id, path }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { code?: string };
      toast.error(t(lang, 'analysisLab', 'genDraft'), { description: body.code ?? `HTTP ${res.status}` });
      return;
    }
    const draft = (await res.json()) as { id: string };
    toast.success(t(lang, 'analysisLab', 'genDraftDone'), { description: draft.id.slice(0, 8) });
  }

  async function generateBva(): Promise<void> {
    if (bvaBusy) return;
    setBvaBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/drafts/from-bva`, {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          variable: bvaVar.trim(),
          min: Number(bvaMin),
          max: Number(bvaMax),
          analysisId: selected?.id,
        }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { code?: string; message?: string };
        toast.error(t(lang, 'analysisLab', 'bvaTitle'), {
          description: body.message ?? body.code ?? `HTTP ${res.status}`,
        });
        return;
      }
      const data = (await res.json()) as { count: number };
      toast.success(t(lang, 'analysisLab', 'bvaDone'), {
        description: t(lang, 'analysisLab', 'bvaCount').replace('{n}', String(data.count)),
      });
      setBvaVar('');
      setBvaMin('');
      setBvaMax('');
    } finally {
      setBvaBusy(false);
    }
  }

  const paths = selected?.metrics?.paths ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4" />
            {t(lang, 'analysisLab', 'title')}
          </CardTitle>
        </CardHeader>
        <div className="flex gap-2 flex-wrap mb-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            aria-label={t(lang, 'analysisLab', 'languageLabel')}
            className="h-10 text-sm border border-neutral-300 rounded-lg px-3 bg-white cursor-pointer"
          >
            <option value="typescript">TypeScript</option>
            <option value="javascript">JavaScript</option>
            <option value="python">Python</option>
          </select>
          <Button onClick={() => void analyze()} disabled={busy || !source.trim()}>
            {t(lang, 'analysisLab', 'analyze')}
          </Button>
        </div>
        <textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder={t(lang, 'analysisLab', 'sourcePlaceholder')}
          rows={6}
          className="w-full text-sm border border-neutral-300 rounded-lg p-3 font-mono focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t(lang, 'analysisLab', 'history')}</CardTitle>
        </CardHeader>
        {items.length === 0 ? (
          <p className="text-sm text-neutral-400">{t(lang, 'analysisLab', 'empty')}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => void openAnalysis(a.id)}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors cursor-pointer ${
                    selected?.id === a.id
                      ? 'border-neutral-950 bg-neutral-50 font-semibold'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  <span className="truncate">
                    {a.name ?? a.id.slice(0, 8)} <span className="text-neutral-400">· {a.language}</span>
                  </span>
                  {statusBadge(a.status)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {selected && (
        <Card className="border-neutral-950">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 flex-wrap">
              {selected.name ?? selected.id.slice(0, 8)}
              {statusBadge(selected.status)}
            </CardTitle>
            <span className="text-xs text-neutral-400">
              {selected.adapterId} {selected.adapterVersion}
            </span>
          </CardHeader>

          {selected.metrics && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              {[
                { label: 'Complexity', value: selected.metrics.complexity },
                { label: 'Decisions', value: selected.metrics.decisions },
                { label: t(lang, 'analysisLab', 'paths'), value: paths.length },
                { label: 'Nodes', value: selected.graph?.nodes.length ?? 0, sub: `${selected.graph?.edges.length ?? 0} edges` },
              ].map((m) => (
                <div key={m.label} className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 text-center" data-testid={`metric-${m.label}`}>
                  <p className="text-2xl font-bold">{m.value}</p>
                  <p className="text-xs text-neutral-500">{m.label}{m.sub ? ` · ${m.sub}` : ''}</p>
                </div>
              ))}
            </div>
          )}

          {(selected.diagnostics ?? []).length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                {t(lang, 'analysisLab', 'diagnostics')} ({selected.diagnostics!.length})
              </p>
              <ul className="space-y-2">
                {selected.diagnostics!.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm bg-white rounded-lg border border-amber-200 px-3 py-2">
                    {diagBadge(d.kind)}
                    <span className="flex-1">{d.message}</span>
                    {d.line != null && (
                      <span className="text-xs text-neutral-400 font-mono">L{d.line}{d.col != null ? `:C${d.col}` : ''}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selected.status === 'SUCCEEDED' && (selected.diagnostics ?? []).length === 0 && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <b>{t(lang, 'analysisLab', 'cleanOk')}</b>
              <span className="text-neutral-500">{t(lang, 'analysisLab', 'cleanOkDesc')}</span>
            </div>
          )}

          {selected.status === 'FAILED' && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-rose-600" />
              <b>{t(lang, 'analysisLab', 'failedTitle')}</b>
              <span className="text-neutral-500">{t(lang, 'analysisLab', 'failedDesc')}</span>
            </div>
          )}

          {paths.length > 0 && (
            <div className="mb-4">
              <p className="text-sm font-bold flex items-center gap-2 mb-2">
                <GitBranch className="w-4 h-4" />
                {t(lang, 'analysisLab', 'pathCoverage')} ({paths.length})
                {selected.metrics?.pathsTruncated && (
                  <span className="text-xs font-normal text-neutral-400">{t(lang, 'analysisLab', 'pathsTruncated')}</span>
                )}
              </p>
              <ul className="space-y-2">
                {paths.map((p, i) => (
                  <li key={i} className="flex items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2 text-sm">
                    <Badge variant="secondary">P{i + 1}</Badge>
                    <code className="flex-1 truncate font-mono text-xs text-neutral-600">{p.join(' → ')}</code>
                    <Button size="sm" variant="outline" onClick={() => void draftFromPath(p)}>
                      {t(lang, 'analysisLab', 'genDraft')}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mb-4 rounded-lg border border-neutral-200 p-4">
            <p className="text-sm font-bold flex items-center gap-2 mb-3">
              <ListChecks className="w-4 h-4" />
              {t(lang, 'analysisLab', 'bvaTitle')}
            </p>
            <p className="text-xs text-neutral-500 mb-3">{t(lang, 'analysisLab', 'bvaDesc')}</p>
            <div className="flex gap-2 flex-wrap">
              <Input
                value={bvaVar}
                onChange={(e) => setBvaVar(e.target.value)}
                placeholder={t(lang, 'analysisLab', 'bvaVar')}
                className="max-w-[180px]"
              />
              <Input
                value={bvaMin}
                onChange={(e) => setBvaMin(e.target.value)}
                placeholder={t(lang, 'analysisLab', 'bvaMin')}
                inputMode="numeric"
                className="max-w-[120px]"
              />
              <Input
                value={bvaMax}
                onChange={(e) => setBvaMax(e.target.value)}
                placeholder={t(lang, 'analysisLab', 'bvaMax')}
                inputMode="numeric"
                className="max-w-[120px]"
              />
              <Button onClick={() => void generateBva()} disabled={bvaBusy || !bvaVar.trim() || !bvaMin || !bvaMax}>
                {t(lang, 'analysisLab', 'bvaGenerate')}
              </Button>
            </div>
          </div>

          {selected.graph && selected.metrics && (
            <CfgViewer
              graph={selected.graph as never}
              source={selected.source}
              paths={paths}
              meta={{ adapterId: selected.adapterId, adapterVersion: selected.adapterVersion }}
              projectId={projectId}
              analysisId={selected.id}
            />
          )}
        </Card>
      )}
    </div>
  );
}
