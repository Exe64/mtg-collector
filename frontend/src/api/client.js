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
  const isForm = body instanceof FormData;
  const headers = {};
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: 'include',
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (res.status === 401 && !_retry && path !== '/auth/refresh') {
    if (await tryRefresh()) return api(path, { method, body, _retry: true });
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
  return data;
}

/** Télécharge un fichier authentifié (export CSV/PDF) et déclenche la sauvegarde. */
export async function apiDownload(path, _retry = false) {
  const headers = {};
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(`/api${path}`, { headers, credentials: 'include' });

  if (res.status === 401 && !_retry && (await tryRefresh())) return apiDownload(path, true);
  if (!res.ok) throw new Error(`Téléchargement échoué (${res.status})`);

  const blob = await res.blob();
  const cd = res.headers.get('Content-Disposition') || '';
  const match = cd.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : 'export';

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
