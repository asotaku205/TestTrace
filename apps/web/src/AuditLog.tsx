// UI tối thiểu nhật ký audit: lọc theo entity, phân trang (nguồn: AUDIT-01).
import { useCallback, useEffect, useState } from 'react';

interface AuditEvent {
  id: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  createdAt: string;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function AuditLog({ projectId }: { projectId: string }) {
  const [items, setItems] = useState<AuditEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [entityType, setEntityType] = useState('');
  const [page, setPage] = useState(1);

  const reload = useCallback(async (): Promise<void> => {
    const params = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (entityType.trim()) params.set('entityType', entityType.trim());
    const res = await fetch(`/api/projects/${projectId}/audit?${params.toString()}`, {
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
      <h4>Nhật ký hoạt động ({total})</h4>
      <input
        value={entityType}
        onChange={(e) => {
          setEntityType(e.target.value);
          setPage(1);
        }}
        placeholder="Lọc entity (vd requirement)"
      />
      <button type="button" onClick={() => void reload()}>
        Lọc
      </button>
      {items.length === 0 ? (
        <p>Chưa có hoạt động nào.</p>
      ) : (
        <ul>
          {items.map((e) => (
            <li key={e.id}>
              {e.action} — {e.entityType}/{e.entityId.slice(0, 8)} lúc{' '}
              {new Date(e.createdAt).toLocaleString()}
            </li>
          ))}
        </ul>
      )}
      <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
        Trước
      </button>{' '}
      <button type="button" onClick={() => setPage((p) => p + 1)}>
        Sau
      </button>
    </div>
  );
}
