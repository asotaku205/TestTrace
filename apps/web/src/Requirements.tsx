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
  score: number | null;
  risk?: { impact: number; likelihood: number } | null;
  criteria: Criterion[];
}

interface Revision {
  version: number;
  title: string;
  createdAt: string;
}

interface ReviewTask {
  id: string;
  reason: string;
  status: string;
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
  const [risks, setRisks] = useState<Record<string, { impact: string; likelihood: string }>>({});
  const [revisions, setRevisions] = useState<Record<string, Revision[]>>({});
  const [tasks, setTasks] = useState<ReviewTask[]>([]);
  const [minScore, setMinScore] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const params = minScore ? `?minScore=${encodeURIComponent(minScore)}` : '';
    const res = await fetch(`/api/projects/${projectId}/requirements${params}`, {
      headers: headers(),
    });
    if (res.ok) setItems((await res.json()) as Requirement[]);
    const tasksRes = await fetch(`/api/projects/${projectId}/review-tasks?status=OPEN`, {
      headers: headers(),
    });
    if (tasksRes.ok) setTasks((await tasksRes.json()) as ReviewTask[]);
  }, [projectId, minScore]);

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

  async function setRisk(id: string): Promise<void> {
    const draft = risks[id] ?? { impact: '3', likelihood: '3' };
    await fetch(`/api/projects/${projectId}/requirements/${id}/risk`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ impact: Number(draft.impact), likelihood: Number(draft.likelihood) }),
    });
    await reload();
  }

  async function showRevisions(id: string): Promise<void> {
    const res = await fetch(`/api/projects/${projectId}/requirements/${id}/revisions`, {
      headers: headers(),
    });
    if (res.ok) {
      const data = (await res.json()) as Revision[];
      setRevisions((prev) => ({ ...prev, [id]: data }));
    }
  }

  async function resolveTask(taskId: string): Promise<void> {
    await fetch(`/api/projects/${projectId}/review-tasks/${taskId}/resolve`, {
      method: 'POST',
      headers: headers(),
    });
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
      <label>
        Lọc score ≥
        <input value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="vd 12" />
        <button type="button" onClick={() => void reload()}>
          Lọc
        </button>
      </label>
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            <strong>{r.code}</strong> {r.title} [{r.status}]
            {r.score !== null && r.score !== undefined && <span> score={r.score}</span>}{' '}
            {r.status === 'DRAFT' && (
              <button type="button" onClick={() => void approve(r.id)}>
                Duyệt
              </button>
            )}{' '}
            <button type="button" onClick={() => void showRevisions(r.id)}>
              Lịch sử
            </button>
            <span>
              impact
              <input
                value={risks[r.id]?.impact ?? String(r.risk?.impact ?? 3)}
                onChange={(e) =>
                  setRisks((prev) => ({
                    ...prev,
                    [r.id]: {
                      impact: e.target.value,
                      likelihood: prev[r.id]?.likelihood ?? String(r.risk?.likelihood ?? 3),
                    },
                  }))
                }
              />
              likelihood
              <input
                value={risks[r.id]?.likelihood ?? String(r.risk?.likelihood ?? 3)}
                onChange={(e) =>
                  setRisks((prev) => ({
                    ...prev,
                    [r.id]: {
                      impact: prev[r.id]?.impact ?? String(r.risk?.impact ?? 3),
                      likelihood: e.target.value,
                    },
                  }))
                }
              />
              <button type="button" onClick={() => void setRisk(r.id)}>
                Chấm risk
              </button>
            </span>
            {(revisions[r.id] ?? []).length > 0 && (
              <ul>
                {(revisions[r.id] ?? []).map((rev) => (
                  <li key={rev.version}>
                    v{rev.version}: {rev.title}
                  </li>
                ))}
              </ul>
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
      {tasks.length > 0 && (
        <div>
          <h5>Review task đang mở ({tasks.length})</h5>
          <ul>
            {tasks.map((t) => (
              <li key={t.id}>
                {t.reason}{' '}
                <button type="button" onClick={() => void resolveTask(t.id)}>
                  Xong
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
