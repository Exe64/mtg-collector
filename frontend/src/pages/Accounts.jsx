import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../stores/auth';

export default function Accounts() {
  const me = useAuth((s) => s.user);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', display_name: '', is_admin: false });
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { users: u } = await api('/auth/users');
      setUsers(u);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function create(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      await api('/auth/users', { method: 'POST', body: form });
      setMsg(`Compte ${form.email} créé`);
      setForm({ email: '', password: '', display_name: '', is_admin: false });
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id, email) {
    if (!window.confirm(`Supprimer le compte ${email} ? Sa collection sera effacée.`)) return;
    try {
      await api(`/auth/users/${id}`, { method: 'DELETE' });
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  const field = 'w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="font-display text-xl font-bold">Comptes</h1>
      {error && <div className="text-sm text-rose-400 bg-rose-950/40 rounded p-2">{error}</div>}

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Créer un compte</h2>
        <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input type="email" required placeholder="Email" value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })} className={field} />
          <input type="text" placeholder="Nom affiché (optionnel)" value={form.display_name}
            onChange={(e) => setForm({ ...form, display_name: e.target.value })} className={field} />
          <input type="password" required placeholder="Mot de passe (8+, 1 maj, 1 chiffre)" value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })} className={field} />
          <label className="flex items-center gap-2 text-sm text-slate-400">
            <input type="checkbox" checked={form.is_admin}
              onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} />
            Administrateur
          </label>
          <div className="sm:col-span-2 flex items-center gap-3">
            <button type="submit" disabled={busy}
              className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm">
              {busy ? '…' : 'Créer le compte'}
            </button>
            {msg && <span className="text-xs text-emerald-400">{msg}</span>}
          </div>
        </form>
      </section>

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Utilisateurs ({users.length})</h2>
        <ul className="divide-y divide-slate-800">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-2 py-2 text-sm">
              <span className="flex-1 min-w-0">
                <span className="block truncate">{u.display_name || u.email}</span>
                <span className="text-xs text-slate-500">{u.email}{u.is_admin && ' · admin'}</span>
              </span>
              <span className="text-xs text-slate-500 hidden sm:block">
                {u.last_login ? `vu ${String(u.last_login).slice(0, 10)}` : 'jamais connecté'}
              </span>
              {u.id !== me?.id && (
                <button type="button" onClick={() => remove(u.id, u.email)}
                  aria-label="Supprimer" className="text-rose-400 hover:text-rose-300 px-1">✕</button>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
