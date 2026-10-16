// UI tối thiểu đính kèm evidence: upload + tải + lưu trữ (nguồn: EVID-01).
import { useCallback, useEffect, useState } from 'react';

interface Attachment {
  id: string;
  originalName: string;
  mime: string;
  size: number;
}

function headers(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` };
}

export function Attachments({
  projectId,
  entityType,
  entityId,
}: {
  projectId: string;
  entityType: 'defect' | 'result';
  entityId: string;
}) {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    const res = await fetch(
      `/api/projects/${projectId}/evidence?entityType=${entityType}&entityId=${entityId}`,
      { headers: headers() },
    );
    if (res.ok) setItems((await res.json()) as Attachment[]);
  }, [projectId, entityType, entityId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function upload(file: File | undefined): Promise<void> {
    if (!file) return;
    setError(null);
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(
      `/api/projects/${projectId}/evidence?entityType=${entityType}&entityId=${entityId}`,
      { method: 'POST', headers: headers(), body: form },
    );
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    await reload();
  }

  async function archive(id: string): Promise<void> {
    await fetch(`/api/projects/${projectId}/evidence/${id}`, {
      method: 'DELETE',
      headers: headers(),
    });
    await reload();
  }

  return (
    <div>
      <h6>Đính kèm ({items.length})</h6>
      <input
        type="file"
        onChange={(e) => void upload(e.target.files?.[0])}
        aria-label="Chọn file đính kèm"
      />
      <ul>
        {items.map((a) => (
          <li key={a.id}>
            <a href={`/api/projects/${projectId}/evidence/${a.id}/download`}>{a.originalName}</a> (
            {a.mime}, {a.size} bytes){' '}
            <button type="button" onClick={() => void archive(a.id)}>
              Lưu trữ
            </button>
          </li>
        ))}
      </ul>
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
