import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useAuth } from '../stores/auth';

const fmtDate = (d) => (d ? new Date(d).toLocaleString('fr-FR') : '—');
const fmtSize = (b) => (b ? `${(b / 1e6).toFixed(1)} Mo` : '—');

function Dot({ ok }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />;
}

function JobLine({ label, job, runningLabel }) {
  let state = <span className="text-slate-500">jamais lancé ici</span>;
  if (job?.running) state = <span className="text-gold-300">⏳ {runningLabel} (depuis {fmtDate(job.startedAt)})</span>;
  else if (job?.finishedAt) {
    state = job.ok
      ? <span className="text-emerald-400">✓ terminé {fmtDate(job.finishedAt)}</span>
      : <span className="text-rose-400">✗ échec : {job.error}</span>;
  }
  return <div className="flex justify-between gap-2 text-xs"><span className="text-slate-400">{label}</span>{state}</div>;
}

export default function Accounts() {
  const me = useAuth((s) => s.user);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({ email: '', password: '', display_name: '', is_admin: false });
  const [error, setError] = useState(null);
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  const [status, setStatus] = useState(null);
  const [settings, setSettings] = useState(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionMsg, setActionMsg] = useState(null);

  const load = useCallback(async () => {
    try {
      const { users: u } = await api('/auth/users');
      setUsers(u);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const s = await api('/admin/status');
      setStatus(s);
      setSettings((prev) => prev ?? s.settings);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { load(); loadStatus(); }, [load, loadStatus]);

  // Rafraîchit le statut tant qu'un job tourne
  useEffect(() => {
    const running = status && Object.values(status.jobs || {}).some((j) => j?.running);
    if (!running) return undefined;
    const t = setInterval(loadStatus, 3000);
    return () => clearInterval(t);
  }, [status, loadStatus]);

  async function runAction(path, label) {
    setActionMsg(null);
    try {
      const r = await api(`/admin/actions/${path}`, { method: 'POST' });
      if (path === 'flush-cache') setActionMsg(`Cache vidé : ${r.cleared} clé(s) supprimée(s)`);
      else setActionMsg(r.started ? `${label} lancé…` : `${label} déjà en cours`);
      loadStatus();
    } catch (err) {
      setActionMsg(err.message);
    }
  }

  async function saveSettings(e) {
    e.preventDefault();
    setSavingSettings(true);
    setActionMsg(null);
    try {
      const s = await api('/admin/settings', { method: 'PUT', body: settings });
      setSettings(s);
      setActionMsg('Réglages enregistrés');
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  }

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
  const numField = 'w-24 rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm';
  const jobRunning = (name) => Boolean(status?.jobs?.[name]?.running);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="font-display text-xl font-bold">Administration</h1>
      {error && <div className="text-sm text-rose-400 bg-rose-950/40 rounded p-2">{error}</div>}

      {/* État du système */}
      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">État du système</h2>
        {!status ? (
          <p className="text-xs text-slate-500">Chargement…</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-400">Base de données</span><span><Dot ok={status.health.db} /></span></div>
            <div className="flex justify-between"><span className="text-slate-400">Redis</span><span><Dot ok={status.health.redis} /></span></div>
            <div className="flex justify-between"><span className="text-slate-400">Cartes en base</span><span>{status.data.cards?.toLocaleString('fr-FR')}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Extensions</span><span>{status.data.sets?.toLocaleString('fr-FR')}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Dernier sync bulk</span><span>{fmtDate(status.data.lastBulkSync)}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">Dernier job prix</span><span>{fmtDate(status.data.lastPriceJob)}</span></div>
            <div className="sm:col-span-2 border-t border-slate-800 pt-2 mt-1">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Dernière sauvegarde</span>
                <span>
                  {status.backup
                    ? <>{fmtDate(status.backup.at)} · {fmtSize(status.backup.sizeBytes)} {status.backup.encrypted && '🔒'} · {status.backup.count} fichier(s)</>
                    : <span className="text-slate-500">dossier non monté / aucune</span>}
                </span>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Actions */}
      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => runAction('sync-bulk', 'Sync bulk-data')} disabled={jobRunning('sync-bulk')}
            className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-2 text-sm">
            🔄 {jobRunning('sync-bulk') ? 'Sync en cours…' : 'Sync bulk-data'}
          </button>
          <button type="button" onClick={() => runAction('price-job', 'MAJ prix')} disabled={jobRunning('price-job')}
            className="rounded-md bg-slate-700 hover:bg-slate-600 disabled:opacity-50 px-3 py-2 text-sm">
            💶 {jobRunning('price-job') ? 'MAJ en cours…' : 'MAJ des prix'}
          </button>
          <button type="button" onClick={() => runAction('flush-cache', 'Vider le cache')}
            className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-2 text-sm">
            🧹 Vider le cache
          </button>
        </div>
        {actionMsg && <p className="text-xs text-slate-300 mt-2">{actionMsg}</p>}
        <div className="mt-3 space-y-1">
          <JobLine label="Sync bulk-data" job={status?.jobs?.['sync-bulk']} runningLabel="sync en cours" />
          <JobLine label="MAJ des prix" job={status?.jobs?.['price-job']} runningLabel="MAJ en cours" />
        </div>
      </section>

      {/* Réglages globaux */}
      {settings && (
        <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Réglages globaux</h2>
          <form onSubmit={saveSettings} className="space-y-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">Fréquence du job prix <span className="text-xs text-slate-500">(heures, 1–24 ; appliqué à chaud)</span></span>
              <input type="number" min="1" max="24" value={settings.price_job_hours}
                onChange={(e) => setSettings({ ...settings, price_job_hours: e.target.value })} className={numField} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">Seuil de variation par défaut <span className="text-xs text-slate-500">(%)</span></span>
              <input type="number" min="1" max="1000" value={settings.default_threshold}
                onChange={(e) => setSettings({ ...settings, default_threshold: e.target.value })} className={numField} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-400">Période par défaut des mouvements <span className="text-xs text-slate-500">(jours)</span></span>
              <input type="number" min="1" max="365" value={settings.default_days}
                onChange={(e) => setSettings({ ...settings, default_days: e.target.value })} className={numField} />
            </label>
            <button type="submit" disabled={savingSettings}
              className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-2 text-sm">
              {savingSettings ? '…' : 'Enregistrer'}
            </button>
          </form>
        </section>
      )}

      {/* Création de compte */}
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

      {/* Utilisateurs */}
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
