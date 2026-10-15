// UI tối thiểu requirement + criteria (nguồn: REQ-01).
import { useCallback, useEffect, useState } from 'react';

interface Criterion {
  id: string;
  text: string;
  position: number;
}

interface Requirement {
  id: string;
  code: string;
  title: string;
  status: string;
  criteria: Criterion[];
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function Requirements({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<Requirement[]>([]);
  const [title, setTitle] = useState('');
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/projects/${projectId}/requirements`, { headers: headers() });
    if (res.ok) setItems((await res.json()) as Requirement[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function createRequirement(): Promise<void> {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/requirements`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ title }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    setTitle('');
    await reload();
  }

  async function approve(id: string): Promise<void> {
    await fetch(`/api/projects/${projectId}/requirements/${id}/approve`, {
      method: 'POST',
      headers: headers(),
    });
    await reload();
  }

  async function addCriterion(requirementId: string): Promise<void> {
    const text = texts[requirementId] ?? '';
    if (!text.trim()) return;
    await fetch(`/api/requirements/${requirementId}/criteria`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ text }),
    });
    setTexts((prev) => ({ ...prev, [requirementId]: '' }));
    await reload();
  }

  return (
    <div>
      <h4>Requirement</h4>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề requirement"
      />
      <button type="button" onClick={() => void createRequirement()}>
        Tạo requirement
      </button>
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            <strong>{r.code}</strong> {r.title} [{r.status}]{' '}
            {r.status === 'DRAFT' && (
              <button type="button" onClick={() => void approve(r.id)}>
                Duyệt
              </button>
            )}
            <ul>
              {r.criteria.map((c) => (
                <li key={c.id}>{c.text}</li>
              ))}
            </ul>
            {r.status === 'DRAFT' && (
              <span>
                <input
                  value={texts[r.id] ?? ''}
                  onChange={(e) => setTexts((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  placeholder="Thêm acceptance criteria"
                />
                <button type="button" onClick={() => void addCriterion(r.id)}>
                  Thêm
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
