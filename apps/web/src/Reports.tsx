// UI tối thiểu tải báo cáo CSV (nguồn: REPORT-01).
import { useState } from 'react';

function authHeaders(): HeadersInit {
  return { Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}` };
}

const REPORTS = [
  { name: 'rtm.csv', label: 'RTM' },
  { name: 'execution.csv', label: 'Execution' },
  { name: 'defects.csv', label: 'Defects' },
  { name: 'complexity.csv', label: 'Complexity' },
  { name: 'impact.csv', label: 'Impact' },
  { name: 'gate.csv', label: 'Gate' },
  { name: 'audit.csv', label: 'Audit' },
];

export function Reports({ projectId }: { projectId: string }) {
  const [error, setError] = useState<string | null>(null);

  async function download(name: string): Promise<void> {
    setError(null);
    const res = await fetch(`/api/projects/${projectId}/reports/${name}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      setError(`HTTP ${res.status}`);
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h4>Báo cáo CSV</h4>
      {REPORTS.map((r) => (
        <button key={r.name} type="button" onClick={() => void download(r.name)}>
          Tải {r.label}
        </button>
      ))}{' '}
      {error && <p role="alert">Lỗi: {error}</p>}
    </div>
  );
}
