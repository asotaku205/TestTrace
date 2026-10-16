// Màn hình auth + app shell (nguồn: AUTH-01/AUTH-02).
// Token lưu localStorage cho bản demo; hardening ở M20.
import { useState } from 'react';
import { Projects } from './Projects.js';
import { t, type Language } from './i18n.js';
import { LanguageContext } from './lang.js';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

async function api(path: string, options?: RequestInit): Promise<Response> {
  return fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
  });
}

export function App() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(localStorage.getItem('lang') === 'en' ? 'en' : 'vi');

  function switchLang(next: Language): void {
    setLang(next);
    localStorage.setItem('lang', next);
  }

  async function doLogin(loginEmail: string, loginPassword: string): Promise<boolean> {
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: loginEmail, password: loginPassword }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { code?: string };
      setError(body.code ?? `HTTP ${res.status}`);
      return false;
    }
    const pair = (await res.json()) as TokenPair;
    localStorage.setItem('accessToken', pair.accessToken);
    localStorage.setItem('refreshToken', pair.refreshToken);
    const me = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${pair.accessToken}` },
    });
    if (!me.ok) {
      setError(`HTTP ${me.status}`);
      return false;
    }
    setUserId(((await me.json()) as { id: string }).id);
    return true;
  }

  async function submit(): Promise<void> {
    setError(null);
    setNotice(null);
    if (mode === 'register') {
      const res = await api('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, name: name.trim() || undefined }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { code?: string };
        setError(body.code ?? `HTTP ${res.status}`);
        return;
      }
      setNotice(t(lang, 'auth', 'registerDone'));
      const ok = await doLogin(email, password);
      if (ok) {
        setMode('login');
        setPassword('');
      }
      return;
    }
    await doLogin(email, password);
  }

  async function logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUserId(null);
    setEmail('');
    setPassword('');
  }

  return (
    <LanguageContext.Provider value={lang}>
      {!userId ? (
        <div className="tt-auth-wrap">
          <div className="tt-auth-card">
            <div className="tt-lang-row">
              <select
                aria-label={t(lang, 'app', 'language')}
                value={lang}
                onChange={(e) => switchLang(e.target.value as Language)}
              >
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </div>
            <div className="tt-auth-brand">
              <span className="tt-brand-mark">🧪</span>
              <h1>{t(lang, 'app', 'title')}</h1>
              <p>{t(lang, 'auth', 'tagline')}</p>
            </div>
            {mode === 'register' ? (
              <p className="tt-muted" style={{ textAlign: 'center', fontSize: 13 }}>
                <button
                  type="button"
                  className="tt-btn tt-btn-ghost tt-btn-sm"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setNotice(null);
                  }}
                >
                  ← {t(lang, 'app', 'login')}
                </button>
              </p>
            ) : (
              <p className="tt-muted" style={{ textAlign: 'center', fontSize: 13 }}>
                {t(lang, 'auth', 'needAccount')}{' '}
                <button
                  type="button"
                  className="tt-btn tt-btn-ghost tt-btn-sm"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setNotice(null);
                  }}
                >
                  {t(lang, 'auth', 'register')}
                </button>
              </p>
            )}
            {mode === 'register' && (
              <div className="tt-field">
                <label htmlFor="tt-name">{t(lang, 'auth', 'name')}</label>
                <input
                  id="tt-name"
                  className="tt-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t(lang, 'auth', 'namePlaceholder')}
                  autoComplete="name"
                />
              </div>
            )}
            <div className="tt-field">
              <label htmlFor="tt-email">{t(lang, 'app', 'email')}</label>
              <input
                id="tt-email"
                className="tt-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div className="tt-field">
              <label htmlFor="tt-password">{t(lang, 'app', 'password')}</label>
              <input
                id="tt-password"
                className="tt-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void submit();
                }}
              />
            </div>
            <button type="button" className="tt-btn tt-btn-primary" onClick={() => void submit()}>
              {mode === 'register' ? t(lang, 'auth', 'register') : t(lang, 'app', 'login')}
            </button>
            {notice && (
              <p className="tt-alert tt-alert-ok" role="status">
                {notice}
              </p>
            )}
            {error && (
              <p className="tt-alert tt-alert-error" role="alert">
                {t(lang, 'app', 'error')} {error}
              </p>
            )}
          </div>
        </div>
      ) : (
        <>
          <header className="tt-topbar">
            <div className="tt-brand">
              <span className="tt-brand-mark">🧪</span>
              <span>{t(lang, 'app', 'title')}</span>
            </div>
            <div className="tt-topbar-spacer" />
            <span className="tt-user">
              {t(lang, 'app', 'loggedInAs')} <code>{userId}</code>
            </span>
            <label className="tt-muted" style={{ color: '#c7d2fe', fontSize: 13 }}>
              {t(lang, 'app', 'language')}{' '}
              <select value={lang} onChange={(e) => switchLang(e.target.value as Language)}>
                <option value="vi">Tiếng Việt</option>
                <option value="en">English</option>
              </select>
            </label>
            <button
              type="button"
              className="tt-btn tt-btn-sm tt-btn-ghost"
              style={{ background: 'transparent', color: '#fff', borderColor: '#4338ca' }}
              onClick={() => void logout()}
            >
              {t(lang, 'app', 'logout')}
            </button>
          </header>
          <Projects />
        </>
      )}
    </LanguageContext.Provider>
  );
}
