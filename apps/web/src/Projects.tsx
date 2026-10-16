// Quản trị project/member + shell module (nguồn: AUTH-02).
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Users } from 'lucide-react';
import { t, type Language } from './i18n.js';
import { Sidebar } from './components/Sidebar.js';
import { Topbar } from './components/Topbar.js';
import { Dashboard } from './components/Dashboard.js';
import { Card, CardHeader, CardTitle } from './components/ui/card.js';
import { Input } from './components/ui/input.js';
import { Button } from './components/ui/button.js';
import { Badge } from './components/ui/badge.js';
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

function ModuleCard({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <section id={id} className="tt-module rounded-xl border border-neutral-200 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.06)] scroll-mt-20">
      {children}
    </section>
  );
}

export function Projects({
  lang,
  onLangChange,
  userEmail,
  onLogout,
}: {
  lang: Language;
  onLangChange: (l: Language) => void;
  userEmail: string;
  onLogout: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Project | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');

  async function reload(): Promise<void> {
    const res = await fetch('/api/projects', { headers: headers() });
    if (res.ok) setProjects((await res.json()) as Project[]);
  }

  useEffect(() => {
    void reload();
  }, []);

  async function loadMembers(p: Project): Promise<void> {
    setSelected(p);
    setActiveTab('dashboard');
    const res = await fetch(`/api/projects/${p.id}/members`, { headers: headers() });
    if (res.ok) setMembers((await res.json()) as Member[]);
  }

  async function createProject(): Promise<void> {
    if (!name.trim()) return;
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ name: name.trim() }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { code?: string };
      toast.error(t(lang, 'projects', 'create'), { description: body.code ?? `HTTP ${res.status}` });
      return;
    }
    const created = (await res.json()) as Project;
    setName('');
    await reload();
    toast.success(t(lang, 'projects', 'create'));
    await loadMembers(created);
  }

  async function addMember(): Promise<void> {
    if (!selected || !email.trim()) return;
    const res = await fetch(`/api/projects/${selected.id}/members`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ email: email.trim(), role: 'VIEWER' }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { code?: string };
      toast.error(t(lang, 'projects', 'add'), { description: body.code ?? `HTTP ${res.status}` });
      return;
    }
    setEmail('');
    await loadMembers(selected);
    toast.success(t(lang, 'projects', 'add'));
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
    <div className="flex min-h-screen bg-neutral-100 tt-view-enter">
      <Sidebar
        lang={lang}
        projects={projects}
        selectedId={selected?.id ?? null}
        onSelect={(p) => void loadMembers(p)}
        newName={name}
        onNewNameChange={setName}
        onCreate={() => void createProject()}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar
          lang={lang}
          onLangChange={onLangChange}
          userEmail={userEmail}
          onLogout={onLogout}
          title={selected ? selected.name : t(lang, 'projects', 'title')}
        />
        <main className="p-6 max-w-[1200px] w-full mx-auto">
          {!selected ? (
            <Card>
              <p className="text-neutral-500 text-sm">{t(lang, 'nav', 'noProject')}</p>
            </Card>
          ) : (
            <div key={activeTab} className="tt-view-enter">
              {activeTab === 'dashboard' && <Dashboard projectId={selected.id} lang={lang} onGoToTab={setActiveTab} />}

              {activeTab === 'members' && (
              <ModuleCard id="sec-members">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    {t(lang, 'projects', 'membersTitle')} — {selected.name}
                  </CardTitle>
                  <Badge variant="secondary">{selected.role}</Badge>
                </CardHeader>
                <ul className="space-y-2 mb-4">
                  {members.map((m) => (
                    <li
                      key={m.userId}
                      className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg bg-neutral-50/50 flex-wrap"
                    >
                      <span className="text-sm flex-1 min-w-[160px]">
                        {m.user.email} <Badge variant="outline" className="ml-1">{m.role}</Badge>
                      </span>
                      <select
                        value={m.role}
                        onChange={(e) => void changeRole(m.userId, e.target.value)}
                        className="h-8 text-sm border border-neutral-300 rounded-md px-2 bg-white cursor-pointer"
                      >
                        {['OWNER', 'MANAGER', 'TESTER', 'VIEWER'].map((r) => (
                          <option key={r} value={r}>
                            {r}
                          </option>
                        ))}
                      </select>
                      <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => void removeMember(m.userId)}>
                        {t(lang, 'projects', 'remove')}
                      </Button>
                    </li>
                  ))}
                </ul>
                <div className="flex gap-2">
                  <Input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t(lang, 'projects', 'emailPlaceholder')}
                    className="max-w-xs"
                  />
                  <Button variant="outline" onClick={() => void addMember()}>
                    {t(lang, 'projects', 'add')}
                  </Button>
                </div>
              </ModuleCard>
              )}

              {activeTab === 'requirements' && <ModuleCard id="sec-requirements"><Requirements projectId={selected.id} /></ModuleCard>}
              {activeTab === 'testrepo' && <ModuleCard id="sec-testrepo"><TestRepo projectId={selected.id} /></ModuleCard>}
              {activeTab === 'releases' && <ModuleCard id="sec-releases"><Releases projectId={selected.id} /></ModuleCard>}
              {activeTab === 'runs' && <ModuleCard id="sec-runs"><Runs projectId={selected.id} /></ModuleCard>}
              {activeTab === 'defects' && <ModuleCard id="sec-defects"><Defects projectId={selected.id} /></ModuleCard>}
              {activeTab === 'analysis' && <ModuleCard id="sec-analysis"><AnalysisLab projectId={selected.id} /></ModuleCard>}
              {activeTab === 'code' && <ModuleCard id="sec-code"><CodeRegistry projectId={selected.id} /></ModuleCard>}
              {activeTab === 'impact' && <ModuleCard id="sec-impact"><Impact projectId={selected.id} /></ModuleCard>}
              {activeTab === 'rtm' && <ModuleCard id="sec-rtm"><RtmMatrix projectId={selected.id} /></ModuleCard>}
              {activeTab === 'gates' && <ModuleCard id="sec-gates"><Gates projectId={selected.id} /></ModuleCard>}
              {activeTab === 'reports' && <ModuleCard id="sec-reports"><Reports projectId={selected.id} /></ModuleCard>}
              {activeTab === 'drafts' && <ModuleCard id="sec-drafts"><DraftReview projectId={selected.id} /></ModuleCard>}
              {activeTab === 'audit' && <ModuleCard id="sec-audit"><AuditLog projectId={selected.id} /></ModuleCard>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
