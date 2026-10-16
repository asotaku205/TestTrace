// UI tối thiểu quality gate: YAML editor + validate + publish + versions (nguồn: GATE-01).
import { useCallback, useEffect, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';

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
  const lang = useLang();
  const [gates, setGates] = useState<Gate[]>([]);
  const [name, setName] = useState('');
  const [yaml, setYaml] = useState('open_critical_defects: 0\n');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buildId, setBuildId] = useState<Record<string, string>>({});
  const [evaluations, setEvaluations] = useState<
    Record<
      string,
      Array<{ id: string; verdict: string; results: Array<{ rule: string; status: string }> }>
    >
  >({});

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
    if (body.ok) setMessage(t(lang, 'gates', 'validYaml'));
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

  async function evaluate(gateId: string): Promise<void> {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/gates/${gateId}/evaluate`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ buildId: buildId[gateId] ?? '' }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    const history = await fetch(`/api/projects/${projectId}/gates/${gateId}/evaluations`, {
      headers: headers(),
    });
    if (history.ok) {
      const data = (await history.json()) as Array<{
        id: string;
        verdict: string;
        results: Array<{ rule: string; status: string }>;
      }>;
      setEvaluations((prev) => ({ ...prev, [gateId]: data }));
    }
    await reload();
  }

  return (
    <div>
      <h4>{t(lang, 'gates', 'title')}</h4>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t(lang, 'gates', 'namePlaceholder')}
      />
      <textarea
        value={yaml}
        onChange={(e) => setYaml(e.target.value)}
        placeholder={t(lang, 'gates', 'yamlPlaceholder')}
        rows={5}
        cols={50}
      />
      <button type="button" onClick={() => void validate()}>
        {t(lang, 'gates', 'check')}
      </button>{' '}
      <button type="button" onClick={() => void create()}>
        {t(lang, 'gates', 'create')}
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
                    {t(lang, 'gates', 'publish')} v{v.version}
                  </button>
                )}{' '}
              </span>
            ))}
            <div>
              <input
                value={buildId[g.id] ?? ''}
                onChange={(e) => setBuildId((prev) => ({ ...prev, [g.id]: e.target.value }))}
                placeholder={t(lang, 'gates', 'buildPlaceholder')}
              />
              <button type="button" onClick={() => void evaluate(g.id)}>
                {t(lang, 'gates', 'evaluate')}
              </button>
              <ul>
                {(evaluations[g.id] ?? []).map((e) => (
                  <li key={e.id}>
                    {e.verdict}: {e.results.map((r) => `${r.rule}=${r.status}`).join(', ')}
                  </li>
                ))}
              </ul>
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert">
          {t(lang, 'gates', 'error')} {error}
        </p>
      )}
    </div>
  );
}
