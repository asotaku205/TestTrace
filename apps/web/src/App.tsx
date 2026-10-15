// Màn hình login tối thiểu (nguồn: AUTH-01 demo: đăng nhập, refresh, thu hồi).
// Token lưu localStorage cho bản demo; hardening ở M20.
import { useState } from 'react';

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
    <main style={{ fontFamily: 'sans-serif', maxWidth: 480, margin: '48px auto' }}>
      <h1>TestTrace Intelligence</h1>
      {userId ? (
        <section>
          <p>
            Đã đăng nhập: <code>{userId}</code>
          </p>
          <button type="button" onClick={() => void logout()}>
            Đăng xuất (thu hồi refresh token)
          </button>
        </section>
      ) : (
        <section>
          <label>
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button type="button" onClick={() => void login()}>
            Đăng nhập
          </button>
          {error && <p role="alert">Lỗi: {error}</p>}
        </section>
      )}
    </main>
  );
}
