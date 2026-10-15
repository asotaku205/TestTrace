// UI tối thiểu release/build/environment (nguồn: REL-01).
import { useCallback, useEffect, useState } from 'react';

interface Build {
  id: string;
  number: string;
}

interface Release {
  id: string;
  name: string;
  status: string;
  frozen: boolean;
  builds: Build[];
}

interface Environment {
  id: string;
  name: string;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function Releases({ projectId }: { projectId: string }) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [name, setName] = useState('');
  const [buildNo, setBuildNo] = useState<Record<string, string>>({});
  const [envName, setEnvName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const [rRes, eRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/releases`, { headers: headers() }),
      fetch(`/api/projects/${projectId}/environments`, { headers: headers() }),
    ]);
    if (rRes.ok) setReleases((await rRes.json()) as Release[]);
    if (eRes.ok) setEnvs((await eRes.json()) as Environment[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function post(path: string, body?: unknown): Promise<boolean> {
    setError(null);
    const res = await fetch(path, {
      method: 'POST',
      headers: headers(),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return false;
    }
    await reload();
    return true;
  }

  return (
    <div>
      <h4>Release</h4>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên release" />
      <button
        type="button"
        onClick={() =>
          void (async () => {
            if (await post(`/api/projects/${projectId}/releases`, { name })) setName('');
          })()
        }
      >
        Tạo release
      </button>
      <ul>
        {releases.map((r) => (
          <li key={r.id}>
            {r.name} [{r.status}]{r.frozen && <span> (frozen)</span>} builds:{' '}
            {r.builds.map((b) => b.number).join(', ') || '—'}
            <input
              value={buildNo[r.id] ?? ''}
              onChange={(e) => setBuildNo((prev) => ({ ...prev, [r.id]: e.target.value }))}
              placeholder="Build number"
            />
            <button
              type="button"
              onClick={() =>
                void post(`/api/projects/${projectId}/releases/${r.id}/builds`, {
                  number: buildNo[r.id] ?? '',
                })
              }
            >
              Thêm build
            </button>{' '}
            <button
              type="button"
              onClick={() => void post(`/api/projects/${projectId}/releases/${r.id}/freeze`)}
            >
              Freeze
            </button>
          </li>
        ))}
      </ul>
      <h4>Environment</h4>
      <input
        value={envName}
        onChange={(e) => setEnvName(e.target.value)}
        placeholder="Tên môi trường"
      />
      <button
        type="button"
        onClick={() =>
          void (async () => {
            if (await post(`/api/projects/${projectId}/environments`, { name: envName }))
              setEnvName('');
          })()
        }
      >
        Thêm environment
      </button>
      <ul>
        {envs.map((e) => (
          <li key={e.id}>{e.name}</li>
        ))}
      </ul>
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
