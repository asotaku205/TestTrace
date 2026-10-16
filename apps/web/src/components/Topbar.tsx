import { Search, LogOut, Globe } from 'lucide-react';
import { t, type Language } from '../i18n.js';
import { Button } from './ui/button.js';
import { Input } from './ui/input.js';

export function Topbar({
  lang,
  onLangChange,
  userEmail,
  onLogout,
  title,
}: {
  lang: Language;
  onLangChange: (l: Language) => void;
  userEmail: string;
  onLogout: () => void;
  title: string;
}) {
  return (
    <header className="h-16 bg-white border-b border-neutral-200 flex items-center gap-4 px-6 sticky top-0 z-40">
      <h1 className="text-lg font-bold tracking-tight">{title}</h1>
      <div className="flex-1" />
      <div className="relative hidden md:block">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <Input placeholder={t(lang, 'topbar', 'search')} className="w-72 pl-9" />
      </div>
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Globe className="w-4 h-4" />
        <select
          aria-label={t(lang, 'app', 'language')}
          value={lang}
          onChange={(e) => onLangChange(e.target.value as Language)}
          className="bg-transparent font-medium cursor-pointer focus:outline-none"
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>
      <div className="flex items-center gap-3 pl-3 border-l border-neutral-200">
        <span className="w-9 h-9 rounded-full bg-neutral-950 text-white flex items-center justify-center text-sm font-bold">
          {userEmail.charAt(0).toUpperCase()}
        </span>
        <div className="hidden lg:block min-w-0">
          <p className="text-sm font-semibold truncate max-w-[180px]">{userEmail}</p>
          <p className="text-xs text-neutral-500">
            {t(lang, 'app', 'loggedInAs')}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onLogout} className="text-neutral-500 hover:text-neutral-950">
          <LogOut className="w-4 h-4" />
          {t(lang, 'app', 'logout')}
        </Button>
      </div>
    </header>
  );
}
