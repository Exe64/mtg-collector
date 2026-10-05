import { useState, useEffect } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { api } from '../api/client';

// États : 'idle' (chargé), 'setup' (QR affiché), 'codes' (codes de secours à noter)
export default function Security() {
  const [status, setStatus] = useState(null); // { enabled, backupCodesRemaining }
  const [setup, setSetup] = useState(null); // { qr, secret }
  const [codes, setCodes] = useState(null); // string[] (affichés une seule fois)
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api('/auth/mfa').then(setStatus).catch(() => {});
  useEffect(() => { load(); }, []);

  async function begin() {
    setError(null); setBusy(true);
    try { setSetup(await api('/auth/mfa/setup', { method: 'POST' })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function enable(e) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const { backupCodes } = await api('/auth/mfa/enable', { method: 'POST', body: { code } });
      setCodes(backupCodes); setSetup(null); setCode(''); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function disable(e) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      await api('/auth/mfa/disable', { method: 'POST', body: { code } });
      setCode(''); await load();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  const box = 'w-full rounded-md bg-slate-900 border border-edge px-3 py-2 text-sm';

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="font-display text-xl font-bold mb-1">Sécurité</h1>
      <p className="text-sm text-slate-400 mb-4">
        Double authentification (TOTP) : un code temporaire de ton application d’authentification
        (Google Authenticator, Aegis, etc.) est demandé à la connexion.
      </p>

      {error && <div className="mb-3 text-sm text-rose-400 bg-rose-950/50 rounded p-2">{error}</div>}

      {/* Codes de secours affichés une seule fois après activation */}
      {codes && (
        <div className="mb-4 rounded-lg border border-gold-700/60 bg-gold-950/30 p-4">
          <h2 className="font-semibold text-gold-200 mb-1">Codes de secours</h2>
          <p className="text-xs text-gold-200/80 mb-3">
            Note-les maintenant : chacun ne sert qu’une fois et ils ne seront plus jamais affichés.
            Ils permettent de te connecter si tu perds ton téléphone.
          </p>
          <ul className="grid grid-cols-2 gap-1 font-mono text-sm">
            {codes.map((c) => <li key={c} className="bg-slate-900 rounded px-2 py-1 text-center">{c}</li>)}
          </ul>
          <button type="button" onClick={() => setCodes(null)}
            className="mt-3 text-xs rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1.5">
            J’ai noté mes codes
          </button>
        </div>
      )}

      {!status ? (
        <div className="text-slate-500">Chargement…</div>
      ) : status.enabled ? (
        <div className="rounded-lg border border-emerald-700/50 bg-emerald-950/20 p-4">
          <div className="flex items-center gap-2 text-emerald-300 mb-1">
            <ShieldCheck size={18} /> <span className="font-semibold">MFA activé</span>
          </div>
          <p className="text-xs text-slate-400 mb-3">
            {status.backupCodesRemaining} code(s) de secours restant(s).
          </p>
          <form onSubmit={disable} className="space-y-2">
            <label className="text-xs text-slate-400">Désactiver (saisis un code actuel ou de secours)</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required
              placeholder="Code" aria-label="Code actuel ou de secours" className={box} />
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-md bg-rose-700 hover:bg-rose-600 disabled:opacity-50 px-3 py-2 text-sm">
              <ShieldOff size={16} /> Désactiver le MFA
            </button>
          </form>
        </div>
      ) : setup ? (
        <div className="rounded-lg border border-slate-700 bg-slate-800 p-4">
          <p className="text-sm mb-3">1. Scanne ce QR code dans ton application d’authentification :</p>
          <img loading="lazy" src={setup.qr} alt="QR code MFA" className="w-44 h-44 bg-white rounded mb-2" />
          <p className="text-xs text-slate-400 mb-3">
            Ou saisis la clé manuellement : <span className="font-mono text-slate-300 break-all">{setup.secret}</span>
          </p>
          <form onSubmit={enable} className="space-y-2">
            <label className="text-sm">2. Saisis le code affiché pour confirmer :</label>
            <input value={code} onChange={(e) => setCode(e.target.value)} required autoFocus
              inputMode="numeric" placeholder="123456" aria-label="Code de confirmation" className={`${box} tracking-widest`} />
            <button type="submit" disabled={busy}
              className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-3 py-2 text-sm font-medium">
              Activer
            </button>
          </form>
        </div>
      ) : (
        <button type="button" onClick={begin} disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-4 py-2 text-sm font-medium">
          <ShieldCheck size={16} /> Activer le MFA
        </button>
      )}
    </div>
  );
}
