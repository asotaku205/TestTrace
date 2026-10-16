// UI tối thiểu quality gate: YAML editor + validate + publish + versions (nguồn: GATE-01).
import { useCallback, useEffect, useState } from 'react';

interface GateVersion {
  version: number;
  status: string;
}

interface Gate {
  id: string;
  name: string;
  versions: GateVersion[];
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function Gates({ projectId }: { projectId: string }) {
  const [gates, setGates] = useState<Gate[]>([]);
  const [name, setName] = useState('');
  const [yaml, setYaml] = useState('open_critical_defects: 0\n');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/projects/${projectId}/gates`, { headers: headers() });
    if (res.ok) setGates((await res.json()) as Gate[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function validate(): Promise<void> {
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/projects/${projectId}/gates/validate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ yaml }),
    });
    const body = (await res.json()) as { ok: boolean; errors: string[] };
    if (body.ok) setMessage('YAML hợp lệ');
    else setError(body.errors.join('; '));
  }

  async function create(): Promise<void> {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/gates`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name, yaml }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    setName('');
    await reload();
  }

  async function publish(gateId: string, version: number): Promise<void> {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/gates/${gateId}/publish`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ version }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    await reload();
  }

  return (
    <div>
      <h4>Quality Gate</h4>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên gate" />
      <textarea
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        placeholder="Luật YAML"
        rows={5}
        cols={50}
      />
      <button type="button" onClick={() => void validate()}>
        Kiểm tra
      </button>{' '}
      <button type="button" onClick={() => void create()}>
        Tạo gate
      </button>
      {message && <p role="status">{message}</p>}
      <ul>
        {gates.map((g) => (
          <li key={g.id}>
            {g.name}{' '}
            {g.versions.map((v) => (
              <span key={v.version}>
                v{v.version}[{v.status}]{' '}
                {v.status === 'DRAFT' && (
                  <button type="button" onClick={() => void publish(g.id, v.version)}>
                    Publish v{v.version}
                  </button>
                )}{' '}
              </span>
            ))}
          </li>
        ))}
      </ul>
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
