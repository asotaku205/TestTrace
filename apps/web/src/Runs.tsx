// UI tối thiểu lập run + xem items snapshot (nguồn: RUN-01; thực thi ở RUN-02).
import { useCallback, useEffect, useState } from 'react';
import { Attachments } from './Attachments.js';
import { t } from './i18n.js';
import { useLang } from './lang.js';

interface RunItem {
  id: string;
  testCaseId: string;
  snapshot: { code: string; title: string };
  results: Array<{ id: string; status: string }>;
}

interface RunProgress {
  done: number;
  total: number;
  percent: number | null;
}

interface Run {
  id: string;
  name: string;
  status: string;
  version: number;
  _count: { items: number };
}

interface Option {
  id: string;
  name?: string;
  number?: string;
}

import { authHeaders as headers, apiFetch } from './lib/api.js';

export function Runs({ projectId }: { projectId: string }) {
  const lang = useLang();
  const [runs, setRuns] = useState<Run[]>([]);
  const [releases, setReleases] = useState<Array<Option & { builds: Option[] }>>([]);
  const [envs, setEnvs] = useState<Option[]>([]);
  const [suites, setSuites] = useState<Option[]>([]);
  const [name, setName] = useState('');
  const [releaseId, setReleaseId] = useState('');
  const [buildId, setBuildId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [suiteId, setSuiteId] = useState('');
  const [selected, setSelected] = useState<
    (Run & { items: RunItem[]; progress: RunProgress }) | null
  >(null);
  const [resultDraft, setResultDraft] = useState<
    Record<string, { status: string; actualResult: string; reason: string }>
  >({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const [rRes, relRes, eRes, sRes] = await Promise.all([
      apiFetch(`/api/projects/${projectId}/runs`, { headers: headers() }),
      apiFetch(`/api/projects/${projectId}/releases`, { headers: headers() }),
      apiFetch(`/api/projects/${projectId}/environments`, { headers: headers() }),
      apiFetch(`/api/projects/${projectId}/suites`, { headers: headers() }),
    ]);
    if (rRes.ok) setRuns((await rRes.json()) as Run[]);
    if (relRes.ok) setReleases((await relRes.json()) as Array<Option & { builds: Option[] }>);
    if (eRes.ok) setEnvs((await eRes.json()) as Option[]);
    if (sRes.ok) setSuites((await sRes.json()) as Option[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createRun(): Promise<void> {
    setError(null);
    const res = await apiFetch(`/api/projects/${projectId}/runs`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name, releaseId, buildId, environmentId, suiteId }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    setName('');
    await reload();
  }

  async function openRun(id: string): Promise<void> {
    const res = await apiFetch(`/api/projects/${projectId}/runs/${id}`, { headers: headers() });
    if (res.ok)
      setSelected((await res.json()) as Run & { items: RunItem[]; progress: RunProgress });
  }

  async function saveResult(itemId: string): Promise<void> {
    if (!selected) return;
    setError(null);
    const draft = resultDraft[itemId] ?? { status: 'PASS', actualResult: '', reason: '' };
    const res = await apiFetch(
      `/api/projects/${projectId}/runs/${selected.id}/items/${itemId}/result`,
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({
          status: draft.status,
          actualResult: draft.actualResult || undefined,
          reason: draft.reason || undefined,
        }),
      },
    );
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    await openRun(selected.id);
  }

  async function finalizeRun(): Promise<void> {
    if (!selected) return;
    setError(null);
    const res = await apiFetch(`/api/projects/${projectId}/runs/${selected.id}/finalize`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ version: selected.version }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    await openRun(selected.id);
    await reload();
  }

  const builds = releases.find((r) => r.id === releaseId)?.builds ?? [];

  return (
    <div>
      <h4>{t(lang, 'runs', 'title')}</h4>
      <button type="button" onClick={() => void reload()}>
        {t(lang, 'runs', 'reload')}
      </button>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t(lang, 'runs', 'namePlaceholder')}
      />
      <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)}>
        <option value="">{t(lang, 'runs', 'pickRelease')}</option>
        {releases.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select value={buildId} onChange={(e) => setBuildId(e.target.value)}>
        <option value="">{t(lang, 'runs', 'pickBuild')}</option>
        {builds.map((b) => (
          <option key={b.id} value={b.id}>
            {b.number}
          </option>
        ))}
      </select>
      <select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)}>
        <option value="">{t(lang, 'runs', 'pickEnv')}</option>
        {envs.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)}>
        <option value="">{t(lang, 'runs', 'pickSuite')}</option>
        {suites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => void createRun()}>
        {t(lang, 'runs', 'create')}
      </button>
      <ul>
        {runs.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => void openRun(r.id)}>
              {r.name} [{r.status}] ({r._count.items} items)
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <p>
            {t(lang, 'runs', 'progress')}: {selected.progress.done}/{selected.progress.total}
            {selected.progress.percent !== null && ` (${selected.progress.percent}%)`}
          </p>
          {selected.status === 'OPEN' && (
            <button type="button" onClick={() => void finalizeRun()}>
              {t(lang, 'runs', 'finalize')}
            </button>
          )}
          <ol>
            {selected.items.map((item) => (
              <li key={item.id}>
                {item.snapshot.code} {item.snapshot.title} —{' '}
                {item.results[0]?.status ?? t(lang, 'runs', 'notRun')}{' '}
                {item.results[0] && (
                  <Attachments
                    projectId={projectId}
                    entityType="result"
                    entityId={item.results[0].id}
                  />
                )}
                {item.results[0]?.status === 'FAIL' && (
                  <button
                    type="button"
                    onClick={() =>
                      void (async () => {
                        setError(null);
                        const res = await apiFetch(`/api/projects/${projectId}/defects/from-result`, {
                          method: 'POST',
                          headers: headers(),
                          body: JSON.stringify({ resultId: item.results[0].id }),
                        });
                        if (!res.ok) {
                          setError(
                            ((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`,
                          );
                        }
                      })()
                    }
                  >
                    {t(lang, 'runs', 'defectFromFail')}
                  </button>
                )}
                {selected.status === 'OPEN' && (
                  <span>
                    <select
                      value={resultDraft[item.id]?.status ?? 'PASS'}
                      onChange={(e) =>
                        setResultDraft((prev) => ({
                          ...prev,
                          [item.id]: {
                            status: e.target.value,
                            actualResult: prev[item.id]?.actualResult ?? '',
                            reason: prev[item.id]?.reason ?? '',
                          },
                        }))
                      }
                    >
                      {['PASS', 'FAIL', 'BLOCKED', 'SKIPPED'].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      value={resultDraft[item.id]?.actualResult ?? ''}
                      onChange={(e) =>
                        setResultDraft((prev) => ({
                          ...prev,
                          [item.id]: {
                            status: prev[item.id]?.status ?? 'PASS',
                            actualResult: e.target.value,
                            reason: prev[item.id]?.reason ?? '',
                          },
                        }))
                      }
                      placeholder={t(lang, 'runs', 'actualPlaceholder')}
                    />
                    <input
                      value={resultDraft[item.id]?.reason ?? ''}
                      onChange={(e) =>
                        setResultDraft((prev) => ({
                          ...prev,
                          [item.id]: {
                            status: prev[item.id]?.status ?? 'PASS',
                            actualResult: prev[item.id]?.actualResult ?? '',
                            reason: e.target.value,
                          },
                        }))
                      }
                      placeholder={t(lang, 'runs', 'reasonPlaceholder')}
                    />
                    <button type="button" onClick={() => void saveResult(item.id)}>
                      {t(lang, 'runs', 'saveResult')}
                    </button>
                  </span>
                )}
              </li>
            ))}
          </ol>
        </div>
      )}
      {error && (
        <p role="alert">
          {t(lang, 'runs', 'error')} {error}
        </p>
      )}
    </div>
  );
}
