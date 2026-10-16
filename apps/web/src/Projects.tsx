// UI tối thiểu quản trị project/member (nguồn: AUTH-02).
import { useEffect, useState } from 'react';
import { Requirements } from './Requirements.js';
import { TestRepo } from './TestRepo.js';
import { AuditLog } from './AuditLog.js';
import { Releases } from './Releases.js';
import { Runs } from './Runs.js';
import { AnalysisLab } from './AnalysisLab.js';
import { Defects } from './Defects.js';
import { DraftReview } from './DraftReview.js';

interface Project {
  id: string;
  name: string;
  role: string;
}

interface Member {
  userId: string;
  role: string;
  user: { id: string; email: string; name: string | null };
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('accessToken') ?? ''}`,
  };
}

export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function reload(): Promise<void> {
    const res = await fetch('/api/projects', { headers: headers() });
    if (res.ok) setProjects((await res.json()) as Project[]);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function loadMembers(p: Project): Promise<void> {
    setSelected(p);
    const res = await fetch(`/api/projects/${p.id}/members`, { headers: headers() });
    if (res.ok) setMembers((await res.json()) as Member[]);
  }

  async function createProject(): Promise<void> {
    setError(null);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    setName('');
    await reload();
  }

  async function addMember(): Promise<void> {
    if (!selected) return;
    setError(null);
    const res = await fetch(`/api/projects/${selected.id}/members`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email, role: 'VIEWER' }),
    });
    if (!res.ok) {
      setError(((await res.json()) as { code?: string }).code ?? `HTTP ${res.status}`);
      return;
    }
    setEmail('');
    await loadMembers(selected);
  }

  async function changeRole(userId: string, role: string): Promise<void> {
    if (!selected) return;
    await fetch(`/api/projects/${selected.id}/members/${userId}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ role }),
    });
    await loadMembers(selected);
  }

  async function removeMember(userId: string): Promise<void> {
    if (!selected) return;
    await fetch(`/api/projects/${selected.id}/members/${userId}`, {
      method: 'DELETE',
      headers: headers(),
    });
    await loadMembers(selected);
  }

  return (
    <section>
      <h2>Project</h2>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tên project" />
      <button type="button" onClick={() => void createProject()}>
        Tạo project
      </button>
      <ul>
        {projects.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => void loadMembers(p)}>
              {p.name} ({p.role})
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div>
          <h3>Thành viên — {selected.name}</h3>
          <ul>
            {members.map((m) => (
              <li key={m.userId}>
                {m.user.email} — {m.role}{' '}
                <select value={m.role} onChange={(e) => void changeRole(m.userId, e.target.value)}>
                  {['OWNER', 'MANAGER', 'TESTER', 'VIEWER'].map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>{' '}
                <button type="button" onClick={() => void removeMember(m.userId)}>
                  Xóa
                </button>
              </li>
            ))}
          </ul>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email member"
          />
          <button type="button" onClick={() => void addMember()}>
            Thêm member
          </button>
          <Requirements projectId={selected.id} />
          <TestRepo projectId={selected.id} />
          <AuditLog projectId={selected.id} />
          <Releases projectId={selected.id} />
          <Runs projectId={selected.id} />
          <AnalysisLab projectId={selected.id} />
          <Defects projectId={selected.id} />
          <DraftReview projectId={selected.id} />
        </div>
      )}
      {error && <p role="alert">Lỗi: {error}</p>}
    </section>
  );
}
