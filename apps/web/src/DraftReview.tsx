// UI tối thiểu duyệt draft: list + Approve/Edit/Reject (nguồn: DRAFT-01).
import { useCallback, useEffect, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';

interface Draft {
  id: string;
  technique: string;
  inputs: unknown;
  expectedResult: string | null;
  oracleStatus: string;
  confidence: number;
  status: string;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function DraftReview({ projectId }: { projectId: string }) {
  const lang = useLang();
  const [items, setItems] = useState<Draft[]>([]);
  const [title, setTitle] = useState<Record<string, string>>({});
  const [editJson, setEditJson] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const res = await fetch(`/api/projects/${projectId}/drafts?status=PENDING`, {
      headers: headers(),
    });
    if (res.ok) setItems((await res.json()) as Draft[]);
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function call(path: string, body?: unknown): Promise<boolean> {
    setError(null);
    const res = await fetch(path, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body ?? {}),
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
      <h4>
        {t(lang, 'draftReview', 'title')} ({items.length})
      </h4>
      <button type="button" onClick={() => void reload()}>
        {t(lang, 'draftReview', 'reload')}
      </button>
      <ul>
        {items.map((d) => (
          <li key={d.id}>
            <strong>{d.technique}</strong> confidence={d.confidence} oracle={d.oracleStatus}{' '}
            expected={d.expectedResult ?? '—'}
            <pre>{JSON.stringify(d.inputs)}</pre>
            <input
              value={title[d.id] ?? ''}
              onChange={(e) => setTitle((prev) => ({ ...prev, [d.id]: e.target.value }))}
              placeholder={t(lang, 'draftReview', 'titlePlaceholder')}
            />
            <button
              type="button"
              onClick={() =>
                void call(`/api/projects/${projectId}/drafts/${d.id}/approve`, {
                  title: title[d.id] ?? t(lang, 'draftReview', 'defaultTitle'),
                })
              }
            >
              {t(lang, 'draftReview', 'approve')}
            </button>{' '}
            <input
              value={editJson[d.id] ?? ''}
              onChange={(e) => setEditJson((prev) => ({ ...prev, [d.id]: e.target.value }))}
              placeholder={t(lang, 'draftReview', 'editPlaceholder')}
            />
            <button
              type="button"
              onClick={() => {
                try {
                  const inputs = JSON.parse(editJson[d.id] ?? '{}') as unknown;
                  void call(`/api/projects/${projectId}/drafts/${d.id}/edit`, { inputs });
                } catch {
                  setError(t(lang, 'draftReview', 'invalidJson'));
                }
              }}
            >
              {t(lang, 'draftReview', 'edit')}
            </button>{' '}
            <input
              value={reason[d.id] ?? ''}
              onChange={(e) => setReason((prev) => ({ ...prev, [d.id]: e.target.value }))}
              placeholder={t(lang, 'draftReview', 'reasonPlaceholder')}
            />
            <button
              type="button"
              onClick={() =>
                void call(`/api/projects/${projectId}/drafts/${d.id}/reject`, {
                  reason: reason[d.id] ?? '',
                })
              }
            >
              {t(lang, 'draftReview', 'reject')}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert">
          {t(lang, 'draftReview', 'error')} {error}
        </p>
      )}
    </div>
  );
}
