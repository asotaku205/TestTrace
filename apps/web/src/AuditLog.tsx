// UI tối thiểu nhật ký audit: lọc theo entity, phân trang (nguồn: AUDIT-01).
import { useCallback, useEffect, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';

interface AuditEvent {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
}

import { authHeaders as headers, apiFetch } from './lib/api.js';

export function AuditLog({ projectId }: { projectId: string }) {
  const lang = useLang();
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const reload = useCallback(async (): Promise<void> => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (entityType.trim()) params.set('entityType', entityType.trim());
    const res = await apiFetch(`/api/projects/${projectId}/audit?${params.toString()}`, {
      headers: headers(),
    });
    if (res.ok) {
      const body = (await res.json()) as { items: AuditEvent[]; total: number };
      setItems(body.items);
      setTotal(body.total);
    }
  }, [projectId, entityType, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div>
      <h4>
        {t(lang, 'audit', 'title')} ({total})
      </h4>
      <button type="button" onClick={() => void reload()}>
        {t(lang, 'audit', 'reload')}
      </button>
      <input
        value={entityType}
        onChange={(e) => {
          setEntityType(e.target.value);
          setPage(1);
        }}
        placeholder={t(lang, 'audit', 'filterPlaceholder')}
      />
      <button type="button" onClick={() => void reload()}>
        {t(lang, 'audit', 'filter')}
      </button>
      {items.length === 0 ? (
        <p>{t(lang, 'audit', 'empty')}</p>
      ) : (
        <ul>
          {items.map((e) => (
            <li key={e.id}>
              {e.action} — {e.entityType}/{e.entityId.slice(0, 8)} {t(lang, 'audit', 'at')}{' '}
              {new Date(e.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
      <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
        {t(lang, 'audit', 'prev')}
      </button>{' '}
      <button type="button" onClick={() => setPage((p) => p + 1)}>
        {t(lang, 'audit', 'next')}
      </button>
    </div>
  );
}
