// Ma trận truy vết sống: lọc + trạng thái + drill-down (nguồn: RTM-02).
import { useCallback, useEffect, useState } from 'react';

interface RtmTest {
  id: string;
  code: string;
  status: string;
}

interface RtmRow {
  requirementId: string;
  code: string;
  title: string;
  risk: { score: number } | null;
  status: string;
  reasonCodes: string[];
  evaluatedAt: string;
  testCases: RtmTest[];
}

interface Release {
  id: string;
  name: string;
}

interface ReqDetail {
  linkedTests: Array<{ code: string; status: string }>;
  linkedCodeUnits: Array<{ qualifiedName: string }>;
  needsReview: boolean;
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

const STATUS_COLORS: Record<string, string> = {
  TRUSTED: '#4caf50',
  AT_RISK: '#ff9800',
  STALE: '#9c27b0',
  UNCOVERED: '#9e9e9e',
};

export function RtmMatrix({ projectId }: { projectId: string }) {
  const [rows, setRows] = useState<RtmRow[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [releaseId, setReleaseId] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [minScore, setMinScore] = useState('');
  const [expanded, setExpanded] = useState<Record<string, ReqDetail>>({});

  const reload = useCallback(async (): Promise<void> => {
    const params = new URLSearchParams();
    if (releaseId) params.set('releaseId', releaseId);
    const [rtmRes, relRes] = await Promise.all([
      fetch(`/api/projects/${projectId}/rtm?${params.toString()}`, { headers: headers() }),
      fetch(`/api/projects/${projectId}/releases`, { headers: headers() }),
    ]);
    if (rtmRes.ok) setRows((await rtmRes.json()) as RtmRow[]);
    if (relRes.ok) setReleases((await relRes.json()) as Release[]);
  }, [projectId, releaseId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function expand(row: RtmRow): Promise<void> {
    if (expanded[row.requirementId]) {
      setExpanded((prev) => {
        const next = { ...prev };
        delete next[row.requirementId];
        return next;
      });
      return;
    }
    const res = await fetch(`/api/projects/${projectId}/requirements/${row.requirementId}`, {
      headers: headers(),
    });
    if (res.ok) {
      const detail = (await res.json()) as ReqDetail;
      setExpanded((prev) => ({ ...prev, [row.requirementId]: detail }));
    }
  }

  const filtered = rows.filter(
    (r) =>
      (!statusFilter || r.status === statusFilter) &&
      (!minScore || (r.risk?.score ?? 0) >= Number(minScore)),
  );

  return (
    <div>
      <h4>Living Traceability Matrix ({filtered.length})</h4>
      <select value={releaseId} onChange={(e) => setReleaseId(e.target.value)} aria-label="Release">
        <option value="">Mọi release</option>
        {releases.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <select
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        aria-label="Trạng thái"
      >
        <option value="">Mọi trạng thái</option>
        {['TRUSTED', 'AT_RISK', 'STALE', 'UNCOVERED'].map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <input
        value={minScore}
        onChange={(e) => setMinScore(e.target.value)}
        placeholder="Risk tối thiểu"
      />
      <button type="button" onClick={() => void reload()}>
        Tải lại RTM
      </button>
      {filtered.length === 0 ? (
        <p>Chưa có requirement nào (No evidence).</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Requirement</th>
              <th>Risk</th>
              <th>Trạng thái</th>
              <th>Lý do</th>
              <th>Tests</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.requirementId}>
                <td>
                  <button type="button" onClick={() => void expand(r)}>
                    {r.code} {r.title}
                  </button>
                  {expanded[r.requirementId] && (
                    <div>
                      <div>
                        Tests:{' '}
                        {expanded[r.requirementId].linkedTests
                          .map((t) => `${t.code}[${t.status}]`)
                          .join(', ') || '—'}
                      </div>
                      <div>
                        Code:{' '}
                        {expanded[r.requirementId].linkedCodeUnits
                          .map((u) => u.qualifiedName)
                          .join(', ') || '—'}
                      </div>
                      {expanded[r.requirementId].needsReview && <div>Cần rà soát lại</div>}
                    </div>
                  )}
                </td>
                <td>{r.risk?.score ?? '—'}</td>
                <td>
                  <span style={{ background: STATUS_COLORS[r.status] ?? '#eee' }}>{r.status}</span>
                </td>
                <td>{r.reasonCodes.join(', ') || '—'}</td>
                <td>{r.testCases.map((t) => t.code).join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
