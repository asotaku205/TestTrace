// Màn hình auth + shell chính (nguồn: AUTH-01/AUTH-02).
// Token lưu localStorage cho bản demo; hardening ở M20.
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Projects } from './Projects.js';
import { t, type Language } from './i18n.js';
import { LanguageContext } from './lang.js';
import { Input } from './components/ui/input.js';
import { Button } from './components/ui/button.js';
import { FieldLabel } from './components/ui/badge.js';
import { setAccessToken, clearAuth, logout as doLogout } from './lib/api.js';

const FEATURES = ['featRtm', 'featCfg', 'featGate'] as const;

function BrandPanel({ lang }: { lang: Language }) {
  return (
    <div className="hidden lg:flex w-[44%] bg-neutral-950 text-white flex-col justify-between p-12 relative overflow-hidden">
      <div className="tt-orb tt-orb-animated w-96 h-96 bg-white opacity-[0.07] -top-20 -left-20" />
      <div className="tt-orb w-80 h-80 bg-white opacity-[0.05] bottom-10 right-0" />
      <div className="tt-orb tt-orb-animated w-40 h-40 bg-white opacity-[0.08] top-1/2 left-1/3" />
      <div className="relative flex items-center gap-3">
        <span className="w-10 h-10 rounded-lg bg-white text-neutral-950 flex items-center justify-center font-bold text-xl shadow-[0_0_24px_rgba(255,255,255,0.35)]">
          T
        </span>
        <span className="text-xl font-bold">{t(lang, 'app', 'title')}</span>
      </div>
      <div className="relative">
        <h2 className="text-3xl font-bold leading-snug mb-6">{t(lang, 'auth', 'heroTitle')}</h2>
        <ul className="space-y-4 text-neutral-300">
          {FEATURES.map((k) => (
            <li key={k} className="flex gap-3">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-white text-neutral-950 flex items-center justify-center shrink-0 shadow-[0_0_16px_rgba(255,255,255,0.4)]">
                <Check className="w-3.5 h-3.5" strokeWidth={3} />
              </span>
              <span className="text-[15px]">{t(lang, 'auth', k)}</span>
            </li>
          ))}
        </ul>
      </div>
      <p className="relative text-neutral-500 text-sm">{t(lang, 'auth', 'courseLine')}</p>
    </div>
  );
}

export function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [lang, setLang] = useState<Language>(localStorage.getItem('lang') === 'en' ? 'en' : 'vi');
  useEffect(() => {
    const onExpired = (): void => {
      clearAuth();
      setUserEmail(null);
      toast.error(t(lang, 'app', 'sessionExpired'));
    };
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, [lang]);

  function switchLang(next: Language): void {
    setLang(next);
    localStorage.setItem('lang', next);
  }

  async function doLogin(loginEmail: string, loginPassword: string): Promise<boolean> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { code?: string };
      toast.error(t(lang, 'app', 'login'), { description: body.code ?? `HTTP ${res.status}` });
      return false;
    }
    const pair = (await res.json()) as { accessToken: string };
    setAccessToken(pair.accessToken);
    setUserEmail(loginEmail);
    return true;
  }

  async function submit(): Promise<void> {
    if (busy) return;
    setBusy(true);
    try {
      if (mode === 'register') {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, name: name.trim() || undefined }),
        });
        if (!res.ok) {
          const body = (await res.json()) as { code?: string };
          toast.error(t(lang, 'auth', 'register'), { description: body.code ?? `HTTP ${res.status}` });
          return;
        }
        toast.success(t(lang, 'auth', 'registerDone'));
        const ok = await doLogin(email, password);
        if (ok) {
          setMode('login');
          setPassword('');
        }
        return;
      }
      await doLogin(email, password);
    } finally {
      setBusy(false);
    }
  }

  async function logout(): Promise<void> {
    await doLogout();
    setUserEmail(null);
    setEmail('');
    setPassword('');
  }

  return (
    <LanguageContext.Provider value={lang}>
      {!userEmail ? (
        <div className="min-h-screen flex tt-view-enter">
          <BrandPanel lang={lang} />
          <div className="flex-1 flex items-center justify-center p-8 bg-white relative overflow-hidden">
            <div className="tt-orb w-[480px] h-[480px] bg-neutral-200 opacity-70 -bottom-40 -right-40" />
            <div className="w-full max-w-md relative">
              <div className="lg:hidden flex items-center gap-3 mb-8">
                <span className="w-10 h-10 rounded-lg bg-neutral-950 text-white flex items-center justify-center font-bold text-xl">
                  T
                </span>
                <span className="text-xl font-bold">{t(lang, 'app', 'title')}</span>
              </div>
              <div className="flex justify-end mb-6">
                <select
                  aria-label={t(lang, 'app', 'language')}
                  value={lang}
                  onChange={(e) => switchLang(e.target.value as Language)}
                  className="text-sm border border-neutral-300 rounded-lg px-2 py-1.5 bg-white cursor-pointer"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="en">English</option>
                </select>
              </div>
              <h1 className="text-2xl font-bold mb-1">
                {mode === 'register' ? t(lang, 'auth', 'createAccount') : t(lang, 'auth', 'welcomeBack')}
              </h1>
              <p className="text-neutral-500 mb-8">{t(lang, 'auth', 'tagline')}</p>
              <div className="space-y-4">
                {mode === 'register' && (
                  <div>
                    <FieldLabel htmlFor="tt-name">{t(lang, 'auth', 'name')}</FieldLabel>
                    <Input
                      id="tt-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t(lang, 'auth', 'namePlaceholder')}
                      autoComplete="name"
                    />
                  </div>
                )}
                <div>
                  <FieldLabel htmlFor="tt-email">{t(lang, 'app', 'email')}</FieldLabel>
                  <Input
                    id="tt-email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ban@vidu.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="tt-password">{t(lang, 'app', 'password')}</FieldLabel>
                  <Input
                    id="tt-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void submit();
                    }}
                  />
                </div>
                <Button
                  className="w-full h-11 text-[15px] hover:shadow-[0_0_28px_rgba(0,0,0,0.35)]"
                  onClick={() => void submit()}
                  disabled={busy}
                >
                  {mode === 'register' ? t(lang, 'auth', 'register') : t(lang, 'app', 'login')}
                </Button>
              </div>
              <p className="text-center text-sm text-neutral-500 mt-6">
                {mode === 'register' ? (
                  <>
                    {t(lang, 'auth', 'haveAccount')}{' '}
                    <button
                      type="button"
                      className="text-neutral-950 font-semibold hover:underline cursor-pointer"
                      onClick={() => setMode('login')}
                    >
                      {t(lang, 'app', 'login')}
                    </button>
                  </>
                ) : (
                  <>
                    {t(lang, 'auth', 'needAccount')}{' '}
                    <button
                      type="button"
                      className="text-neutral-950 font-semibold hover:underline cursor-pointer"
                      onClick={() => setMode('register')}
                    >
                      {t(lang, 'auth', 'register')}
                    </button>
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <Projects lang={lang} onLangChange={switchLang} userEmail={userEmail} onLogout={() => void logout()} />
      )}
    </LanguageContext.Provider>
  );
}
