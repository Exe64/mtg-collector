// Client API : access token en mémoire (jamais en localStorage), refresh auto sur 401.
// Le refresh token vit dans un cookie httpOnly géré par le backend.

let accessToken = null;
export const setAccessToken = (t) => { accessToken = t; };

async function tryRefresh() {
  const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
  if (!res.ok) return false;
  const { accessToken: t } = await res.json();
  setAccessToken(t);
  return true;
}

export async function api(path, { method = 'GET', body, _retry = false } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !_retry && path !== '/auth/refresh') {
    if (await tryRefresh()) return api(path, { method, body, _retry: true });
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}
