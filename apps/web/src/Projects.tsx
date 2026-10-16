// Quản trị project/member + layout module (nguồn: AUTH-02).
import { useEffect, useState } from 'react';
import { t } from './i18n.js';
import { useLang } from './lang.js';
import { Requirements } from './Requirements.js';
import { TestRepo } from './TestRepo.js';
import { AuditLog } from './AuditLog.js';
import { Releases } from './Releases.js';
import { Runs } from './Runs.js';
import { AnalysisLab } from './AnalysisLab.js';
import { CodeRegistry } from './CodeRegistry.js';
import { Impact } from './Impact.js';
import { RtmMatrix } from './RtmMatrix.js';
import { Gates } from './Gates.js';
import { Reports } from './Reports.js';
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

const SECTIONS = [
  { id: 'sec-members', key: 'members' },
  { id: 'sec-requirements', key: 'requirements' },
  { id: 'sec-testrepo', key: 'testRepo' },
  { id: 'sec-releases', key: 'releases' },
  { id: 'sec-runs', key: 'runs' },
  { id: 'sec-defects', key: 'defects' },
  { id: 'sec-analysis', key: 'analysisLab' },
  { id: 'sec-code', key: 'codeRegistry' },
  { id: 'sec-impact', key: 'impact' },
  { id: 'sec-rtm', key: 'rtm' },
  { id: 'sec-gates', key: 'gates' },
  { id: 'sec-reports', key: 'reports' },
  { id: 'sec-drafts', key: 'draftReview' },
  { id: 'sec-audit', key: 'auditLog' },
] as const;

export function Projects() {
  const lang = useLang();
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
    <div className="tt-layout">
      <aside className="tt-sidebar">
        <section className="tt-card">
          <h2>{t(lang, 'projects', 'title')}</h2>
          <div className="tt-form-row">
            <input
              className="tt-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t(lang, 'projects', 'namePlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void createProject();
              }}
            />
            <button type="button" className="tt-btn tt-btn-primary" onClick={() => void createProject()}>
              {t(lang, 'projects', 'create')}
            </button>
          </div>
          {error && (
            <p className="tt-alert tt-alert-error" role="alert">
              {t(lang, 'projects', 'error')} {error}
            </p>
          )}
        </section>
        <section className="tt-card">
          <ul className="tt-project-list">
            {projects.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`tt-project-btn${selected?.id === p.id ? ' active' : ''}`}
                  onClick={() => void loadMembers(p)}
                >
                  <span>
                    {p.name} ({p.role})
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {projects.length === 0 && (
            <p className="tt-muted">{t(lang, 'nav', 'noProject')}</p>
          )}
        </section>
      </aside>

      <main className="tt-main">
        {!selected ? (
          <section className="tt-card">
            <p className="tt-muted">{t(lang, 'nav', 'noProject')}</p>
          </section>
        ) : (
          <>
            <nav className="tt-anchor-nav" aria-label="Module">
              {SECTIONS.map((s) => (
                <a key={s.id} href={`#${s.id}`}>
                  {t(lang, 'nav', s.key)}
                </a>
              ))}
            </nav>

            <section className="tt-card" id="sec-members">
              <h2>
                {t(lang, 'projects', 'membersTitle')} — {selected.name}
              </h2>
              <ul className="tt-list">
                {members.map((m) => (
                  <li key={m.userId}>
                    <span>
                      {m.user.email} — {m.role}
                    </span>
                    <select
                      className="tt-select"
                      style={{ width: 'auto' }}
                      value={m.role}
                      onChange={(e) => void changeRole(m.userId, e.target.value)}
                    >
                      {['OWNER', 'MANAGER', 'TESTER', 'VIEWER'].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="tt-btn tt-btn-sm tt-btn-danger-ghost"
                      onClick={() => void removeMember(m.userId)}
                    >
                      {t(lang, 'projects', 'remove')}
                    </button>
                  </li>
                ))}
              </ul>
              <div className="tt-form-row">
                <input
                  className="tt-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t(lang, 'projects', 'emailPlaceholder')}
                />
                <button type="button" className="tt-btn tt-btn-ghost" onClick={() => void addMember()}>
                  {t(lang, 'projects', 'add')}
                </button>
              </div>
            </section>

            <section className="tt-card" id="sec-requirements">
              <Requirements projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-testrepo">
              <TestRepo projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-releases">
              <Releases projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-runs">
              <Runs projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-defects">
              <Defects projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-analysis">
              <AnalysisLab projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-code">
              <CodeRegistry projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-impact">
              <Impact projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-rtm">
              <RtmMatrix projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-gates">
              <Gates projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-reports">
              <Reports projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-drafts">
              <DraftReview projectId={selected.id} />
            </section>
            <section className="tt-card" id="sec-audit">
              <AuditLog projectId={selected.id} />
            </section>
          </>
        )}
      </main>
    </div>
  );
}
