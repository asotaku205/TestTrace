// Màn hình login tối thiểu (nguồn: AUTH-01 demo: đăng nhập, refresh, thu hồi).
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
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lang, setLang] = useState<Language>(localStorage.getItem('lang') === 'en' ? 'en' : 'vi');

  function switchLang(next: Language): void {
    setLang(next);
    localStorage.setItem('lang', next);
  }

  async function login(): Promise<void> {
    setError(null);
    const res = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const body = (await res.json()) as { code?: string };
      setError(body.code ?? `HTTP ${res.status}`);
      return;
    }
    const pair = (await res.json()) as TokenPair;
    localStorage.setItem('accessToken', pair.accessToken);
    localStorage.setItem('refreshToken', pair.refreshToken);
    const me = await api('/api/auth/me', {
      headers: { Authorization: `Bearer ${pair.accessToken}` },
    });
    setUserId(((await me.json()) as { id: string }).id);
  }

  async function logout(): Promise<void> {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await api('/api/auth/logout', { method: 'POST', body: JSON.stringify({ refreshToken }) });
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUserId(null);
  }

  return (
    <LanguageContext.Provider value={lang}>
      <main style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '48px auto' }}>
        <h1>{t(lang, 'app', 'title')}</h1>
        <label>
          {t(lang, 'app', 'language')}
          <select value={lang} onChange={(e) => switchLang(e.target.value as Language)}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        {userId ? (
          <section>
            <p>
              {t(lang, 'app', 'loggedInAs')} <code>{userId}</code>
            </p>
            <button type="button" onClick={() => void logout()}>
              {t(lang, 'app', 'logout')}
            </button>
            <Projects />
          </section>
        ) : (
          <section>
            <label>
              {t(lang, 'app', 'email')}
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </label>
            <label>
              {t(lang, 'app', 'password')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button type="button" onClick={() => void login()}>
              {t(lang, 'app', 'login')}
            </button>
            {error && (
              <p role="alert">
                {t(lang, 'app', 'error')} {error}
              </p>
            )}
          </section>
        )}
      </main>
    </LanguageContext.Provider>
  );
}
