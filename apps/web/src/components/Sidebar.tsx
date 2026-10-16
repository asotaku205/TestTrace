import {
  LayoutDashboard,
  ClipboardList,
  FlaskConical,
  Play,
  Bug,
  Network,
  Zap,
  ShieldCheck,
  BarChart3,
  FileText,
  History,
  FolderKanban,
  Package,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../lib/utils.js';
import { t, type Language } from '../i18n.js';
import { Badge } from './ui/badge.js';
import { Input } from './ui/input.js';
import { Button } from './ui/button.js';

export interface NavItem {
  id: string;
  icon: LucideIcon;
  labelKey: string;
}

export const NAV_SECTIONS: Array<{ titleKey: string | null; items: NavItem[] }> = [
  {
    titleKey: null,
    items: [
      { id: 'dashboard', icon: LayoutDashboard, labelKey: 'dashboard' },
      { id: 'members', icon: Users, labelKey: 'members' },
    ],
  },
  {
    titleKey: 'testMgmt',
    items: [
      { id: 'requirements', icon: ClipboardList, labelKey: 'requirements' },
      { id: 'testrepo', icon: FlaskConical, labelKey: 'testRepo' },
      { id: 'releases', icon: Package, labelKey: 'releases' },
      { id: 'runs', icon: Play, labelKey: 'runs' },
      { id: 'defects', icon: Bug, labelKey: 'defects' },
    ],
  },
  {
    titleKey: 'traceQuality',
    items: [
      { id: 'rtm', icon: Network, labelKey: 'rtm' },
      { id: 'impact', icon: Zap, labelKey: 'impact' },
      { id: 'gates', icon: ShieldCheck, labelKey: 'gates' },
    ],
  },
  {
    titleKey: 'analysis',
    items: [
      { id: 'analysis', icon: BarChart3, labelKey: 'analysisLab' },
      { id: 'code', icon: FileText, labelKey: 'codeRegistry' },
      { id: 'reports', icon: FileText, labelKey: 'reports' },
      { id: 'drafts', icon: History, labelKey: 'draftReview' },
      { id: 'audit', icon: History, labelKey: 'auditLog' },
    ],
  },
];

interface Project {
  id: string;
  name: string;
  role: string;
}

export function Sidebar({
  lang,
  projects,
  selectedId,
  onSelect,
  newName,
  onNewNameChange,
  onCreate,
  activeTab,
  onTabChange,
}: {
  lang: Language;
  projects: Project[];
  selectedId: string | null;
  onSelect: (p: Project) => void;
  newName: string;
  onNewNameChange: (v: string) => void;
  onCreate: () => void;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <aside className="w-64 shrink-0 bg-white border-r border-neutral-200 flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2.5 px-5 border-b border-neutral-200">
        <span className="w-8 h-8 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-bold shadow-[0_0_16px_rgba(0,0,0,0.25)]">
          T
        </span>
        <span className="font-bold tracking-tight">{t(lang, 'app', 'title')}</span>
      </div>

      <div className="px-4 py-4 border-b border-neutral-100">
        <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <FolderKanban className="w-3.5 h-3.5" />
          {t(lang, 'projects', 'title')}
        </p>
        <div className="flex gap-2">
          <Input
            value={newName}
            onChange={(e) => onNewNameChange(e.target.value)}
            placeholder={t(lang, 'projects', 'namePlaceholder')}
            className="h-9"
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCreate();
            }}
          />
          <Button size="sm" className="h-9 shrink-0" onClick={onCreate}>
            {t(lang, 'projects', 'create')}
          </Button>
        </div>
        <ul className="mt-2 space-y-1">
          {projects.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => onSelect(p)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors cursor-pointer',
                  selectedId === p.id
                    ? 'bg-neutral-950 text-white font-semibold'
                    : 'text-neutral-600 hover:bg-neutral-100',
                )}
              >
                <span className="truncate">{p.name}</span>
                <Badge variant={selectedId === p.id ? 'secondary' : 'outline'} className={cn(selectedId === p.id && 'bg-white/20 text-white border-transparent')}>
                  {p.role}
                </Badge>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <nav className="flex-1 px-3 space-y-0.5 text-sm overflow-y-auto pb-4" aria-label="Module">
        {NAV_SECTIONS.map((section, si) => (
          <div key={si}>
            {section.titleKey && (
              <p className="px-3 pt-4 pb-1 text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">
                {t(lang, 'nav', section.titleKey)}
              </p>
            )}
            {section.items.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors cursor-pointer text-left',
                    active
                      ? 'bg-neutral-950 text-white font-semibold shadow-[0_0_16px_rgba(0,0,0,0.22)]'
                      : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-950',
                  )}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  {t(lang, 'nav', item.labelKey)}
                </button>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
