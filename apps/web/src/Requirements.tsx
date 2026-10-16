// UI tối thiểu requirement + criteria (nguồn: REQ-01).
import { useCallback, useEffect, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';

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
  linkedTests: Array<{ id: string; code: string; title: string; status: string }>;
  needsReview: boolean;
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
  const lang = useLang();
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
      <h4>{t(lang, 'requirements', 'title')}</h4>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t(lang, 'requirements', 'titlePlaceholder')}
      />
      <button type="button" onClick={() => void createRequirement()}>
        {t(lang, 'requirements', 'create')}
      </button>
      <label>
        {t(lang, 'requirements', 'filterScore')}
        <input
          value={minScore}
          onChange={(e) => setMinScore(e.target.value)}
          placeholder={t(lang, 'requirements', 'filterExample')}
        />
        <button type="button" onClick={() => void reload()}>
          {t(lang, 'requirements', 'filter')}
        </button>
      </label>
      <ul>
        {items.map((r) => (
          <li key={r.id}>
            <strong>{r.code}</strong> {r.title} [{r.status}]
            {r.score !== null && r.score !== undefined && <span> score={r.score}</span>}{' '}
            {r.needsReview && <mark>{t(lang, 'requirements', 'needsReview')}</mark>}{' '}
            {(r.linkedTests ?? []).length > 0 && (
              <span>
                test: {(r.linkedTests ?? []).map((t) => `${t.code}[${t.status}]`).join(', ')}{' '}
              </span>
            )}
            {r.status === 'DRAFT' && (
              <button type="button" onClick={() => void approve(r.id)}>
                {t(lang, 'requirements', 'approve')}
              </button>
            )}{' '}
            <button type="button" onClick={() => void showRevisions(r.id)}>
              {t(lang, 'requirements', 'history')}
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
                {t(lang, 'requirements', 'rateRisk')}
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
                  placeholder={t(lang, 'requirements', 'criteriaPlaceholder')}
                />
                <button type="button" onClick={() => void addCriterion(r.id)}>
                  {t(lang, 'requirements', 'add')}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {tasks.length > 0 && (
        <div>
          <h5>
            {t(lang, 'requirements', 'openTasks')} ({tasks.length})
          </h5>
          <ul>
            {tasks.map((task) => (
              <li key={task.id}>
                {task.reason}{' '}
                <button type="button" onClick={() => void resolveTask(task.id)}>
                  {t(lang, 'requirements', 'done')}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error && (
        <p role="alert">
          {t(lang, 'requirements', 'error')} {error}
        </p>
      )}
    </div>
  );
}
