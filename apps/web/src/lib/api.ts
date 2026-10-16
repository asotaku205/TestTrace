// API client trung tâm: gắn access token, tự refresh khi 401 (silent refresh).
// Refresh token nằm ở HttpOnly cookie nên fetch cần credentials: 'include'.
const ACCESS_KEY = 'accessToken';

let refreshPromise: Promise<boolean> | null = null;

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function setAccessToken(token: string): void {
  localStorage.setItem(ACCESS_KEY, token);
}

export function clearAuth(): void {
  localStorage.removeItem(ACCESS_KEY);
}

export function authHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getAccessToken() ?? ''}`,
  };
}

async function doRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        if (!res.ok) return false;
        const body = (await res.json()) as { accessToken?: string };
        if (!body.accessToken) return false;
        setAccessToken(body.accessToken);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

/** Fetch có tự động refresh token khi gặp 401. Dùng thay cho fetch() trực tiếp. */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const opts: RequestInit = {
    ...options,
    credentials: 'include',
    headers: { ...authHeaders(), ...(options?.headers ?? {}) },
  };
  let res = await fetch(path, opts);
  if (res.status !== 401 || path === '/api/auth/refresh') return res;
  const ok = await doRefresh();
  if (!ok) {
    window.dispatchEvent(new Event('auth:expired'));
    return res;
  }
  return fetch(path, {
    ...opts,
    headers: { ...authHeaders(), ...(options?.headers ?? {}) },
  });
}

/** Đăng xuất: thu hồi refresh token (cookie) rồi xóa access token. */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
  } catch {
    // bỏ qua lỗi mạng khi logout
  }
  clearAuth();
}
