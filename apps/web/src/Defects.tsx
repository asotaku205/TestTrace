// UI tối thiểu defect: tạo, lọc, chuyển trạng thái, timeline (nguồn: BUG-01).
import { useCallback, useEffect, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';
import { Attachments } from './Attachments.js';

interface HistoryEntry {
  from: string;
  to: string;
  actorId: string;
  createdAt: string;
}

interface Defect {
  id: string;
  code: string;
  title: string;
  severity: string;
  priority: string;
  status: string;
  history?: HistoryEntry[];
}

import { authHeaders as headers, apiFetch } from './lib/api.js';

const NEXT: Record<string, string[]> = {
  NEW: ['TRIAGED', 'REJECTED'],
  TRIAGED: ['ASSIGNED', 'REJECTED'],
  ASSIGNED: ['IN_PROGRESS'],
  IN_PROGRESS: ['FIXED'],
  FIXED: ['RETEST'],
  RETEST: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED'],
  CLOSED: [],
  REJECTED: [],
};

export function Defects({ projectId }: { projectId: string }) {
  const lang = useLang();
  const [items, setItems] = useState<Defect[]>([]);
  const [title, setTitle] = useState('');
  const [severity, setSeverity] = useState('MAJOR');
  const [steps, setSteps] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Defect | null>(null);
  const [fixedBuildId, setFixedBuildId] = useState('');
  const [retestBuildId, setRetestBuildId] = useState('');
  const [retestEnvId, setRetestEnvId] = useState('');
  const [resolveResultId, setResolveResultId] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const params = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : '';
    const res = await apiFetch(`/api/projects/${projectId}/defects${params}`, {
      headers: headers(),
    });
    if (res.ok) setItems((await res.json()) as Defect[]);
  }, [projectId, statusFilter]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createDefect(): Promise<void> {
    setError(null);
    const res = await apiFetch(`/api/projects/${projectId}/defects`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ title, severity, stepsToReproduce: steps || undefined }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    setTitle('');
    setSteps('');
    await reload();
  }

  async function openDefect(id: string): Promise<void> {
    const res = await apiFetch(`/api/projects/${projectId}/defects/${id}`, { headers: headers() });
    if (res.ok) setSelected((await res.json()) as Defect);
  }

  async function move(to: string): Promise<void> {
    if (!selected) return;
    setError(null);
    const res = await apiFetch(`/api/projects/${projectId}/defects/${selected.id}/transition`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ to, fixedBuildId: fixedBuildId || undefined }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    await openDefect(selected.id);
    await reload();
  }

  return (
    <div>
      <h4>{t(lang, 'defects', 'title')}</h4>
      <button type="button" onClick={() => void reload()}>
        {t(lang, 'defects', 'reload')}
      </button>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t(lang, 'defects', 'titlePlaceholder')}
      />
      <select value={severity} onChange={(e) => setSeverity(e.target.value)}>
        {['BLOCKER', 'CRITICAL', 'MAJOR', 'MINOR', 'TRIVIAL'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
        placeholder={t(lang, 'defects', 'stepsPlaceholder')}
      />
      <button type="button" onClick={() => void createDefect()}>
        {t(lang, 'defects', 'create')}
      </button>
      <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
        <option value="">{t(lang, 'defects', 'allStatuses')}</option>
        {Object.keys(NEXT).map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <ul>
        {items.map((d) => (
          <li key={d.id}>
            <button type="button" onClick={() => void openDefect(d.id)}>
              {d.code} {d.title} [{d.status}] {d.severity}
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <h5>
            {selected.code} {selected.title}
          </h5>
          <input
            value={fixedBuildId}
            onChange={(e) => setFixedBuildId(e.target.value)}
            placeholder={t(lang, 'defects', 'fixedBuildPlaceholder')}
          />
          <div>
            {(NEXT[selected.status] ?? []).map((to) => (
              <button key={to} type="button" onClick={() => void move(to)}>
                → {to}
              </button>
            ))}
          </div>
          {selected.status === 'FIXED' && (
            <div>
              <input
                value={retestBuildId}
                onChange={(e) => setRetestBuildId(e.target.value)}
                placeholder={t(lang, 'defects', 'retestBuildPlaceholder')}
              />
              <input
                value={retestEnvId}
                onChange={(e) => setRetestEnvId(e.target.value)}
                placeholder={t(lang, 'defects', 'retestEnvPlaceholder')}
              />
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    setError(null);
                    const res = await apiFetch(
                      `/api/projects/${projectId}/defects/${selected.id}/retest`,
                      {
                        method: 'POST',
                        headers: headers(),
                        body: JSON.stringify({
                          buildId: retestBuildId,
                          environmentId: retestEnvId,
                        }),
                      },
                    );
                    if (!res.ok) {
                      setError(
                        ((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`,
                      );
                      return;
                    }
                    await openDefect(selected.id);
                    await reload();
                  })()
                }
              >
                {t(lang, 'defects', 'createRetest')}
              </button>
            </div>
          )}
          {selected.status === 'RETEST' && (
            <div>
              <input
                value={resolveResultId}
                onChange={(e) => setResolveResultId(e.target.value)}
                placeholder={t(lang, 'defects', 'resolvePlaceholder')}
              />
              <button
                type="button"
                onClick={() =>
                  void (async () => {
                    setError(null);
                    const res = await apiFetch(
                      `/api/projects/${projectId}/defects/${selected.id}/retest-resolve`,
                      {
                        method: 'POST',
                        headers: headers(),
                        body: JSON.stringify({ resultId: resolveResultId }),
                      },
                    );
                    if (!res.ok) {
                      setError(
                        ((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`,
                      );
                      return;
                    }
                    await openDefect(selected.id);
                    await reload();
                  })()
                }
              >
                {t(lang, 'defects', 'resolve')}
              </button>
            </div>
          )}
          <ol>
            {(selected.history ?? []).map((h, i) => (
              <li key={i}>
                {h.from} → {h.to}
              </li>
            ))}
          </ol>
          <Attachments projectId={projectId} entityType="defect" entityId={selected.id} />
        </div>
      )}
      {error && (
        <p role="alert">
          {t(lang, 'defects', 'error')} {error}
        </p>
      )}
    </div>
  );
}
