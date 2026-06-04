import { create } from 'zustand';
import { api, setAccessToken } from '../api/client';

export const useAuth = create((set) => ({
  user: null,
  status: 'loading', // 'loading' | 'authed' | 'guest'

  // Au démarrage : tente un refresh via le cookie httpOnly, puis charge /me.
  async bootstrap() {
    try {
      const r = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
      if (!r.ok) throw new Error('no session');
      const { accessToken } = await r.json();
      setAccessToken(accessToken);
      const { user } = await api('/auth/me');
      set({ user, status: 'authed' });
    } catch {
      setAccessToken(null);
      set({ user: null, status: 'guest' });
    }
  },

  async login(email, password) {
    const { user, accessToken } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setAccessToken(accessToken);
    set({ user, status: 'authed' });
  },

  async register(email, password, display_name) {
    const { user, accessToken } = await api('/auth/register', {
      method: 'POST',
      body: { email, password, display_name },
    });
    setAccessToken(accessToken);
    set({ user, status: 'authed' });
  },

  async logout() {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    setAccessToken(null);
    set({ user: null, status: 'guest' });
  },
}));
