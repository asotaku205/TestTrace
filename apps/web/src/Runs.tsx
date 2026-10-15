// UI tối thiểu lập run + xem items snapshot (nguồn: RUN-01; thực thi ở RUN-02).
import { useCallback, useEffect, useState } from 'react';

interface RunItem {
  id: string;
  testCaseId: string;
  snapshot: { code: string; title: string };
}

interface Run {
  id: string;
  name: string;
  status: string;
  _count: { items: number };
}

interface Option {
  id: string;
  name?: string;
  number?: string;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function Runs({ projectId }: { projectId: string }) {
  const [runs, setRuns] = useState<Run[]>([]);
  const [releases, setReleases] = useState<Array<Option & { builds: Option[] }>>([]);
  const [envs, setEnvs] = useState<Option[]>([]);
  const [suites, setSuites] = useState<Option[]>([]);
  const [name, setName] = useState('');
  const [releaseId, setReleaseId] = useState('');
  const [buildId, setBuildId] = useState('');
  const [environmentId, setEnvironmentId] = useState('');
  const [suiteId, setSuiteId] = useState('');
  const [selected, setSelected] = useState<(Run & { items: RunItem[] }) | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const [rRes, relRes, eRes, sRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/runs`, { headers: headers() }),
      fetch(`/api/projects/${projectId}/releases`, { headers: headers() }),
      fetch(`/api/projects/${projectId}/environments`, { headers: headers() }),
      fetch(`/api/projects/${projectId}/suites`, { headers: headers() }),
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
    const res = await fetch(`/api/projects/${projectId}/runs`, {
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
    const res = await fetch(`/api/projects/${projectId}/runs/${id}`, { headers: headers() });
    if (res.ok) setSelected((await res.json()) as Run & { items: RunItem[] });
  }

  const builds = releases.find((r) => r.id === releaseId)?.builds ?? [];

  return (
    <div>
      <h4>Test run</h4>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên run" />
      <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)}>
        <option value="">Chọn release</option>
        {releases.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select value={buildId} onChange={(e) => setBuildId(e.target.value)}>
        <option value="">Chọn build</option>
        {builds.map((b) => (
          <option key={b.id} value={b.id}>
            {b.number}
          </option>
        ))}
      </select>
      <select value={environmentId} onChange={(e) => setEnvironmentId(e.target.value)}>
        <option value="">Chọn environment</option>
        {envs.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
      <select value={suiteId} onChange={(e) => setSuiteId(e.target.value)}>
        <option value="">Chọn suite</option>
        {suites.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="button" onClick={() => void createRun()}>
        Lập run
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
        <ol>
          {selected.items.map((item) => (
            <li key={item.id}>
              {item.snapshot.code} {item.snapshot.title}
            </li>
          ))}
        </ol>
      )}
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
