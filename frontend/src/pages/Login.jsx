import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { api } from '../api/client';

export default function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api('/auth/setup-status').then((d) => setNeedsSetup(d.needsSetup)).catch(() => {});
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm bg-slate-800 rounded-xl p-6 space-y-4">
        <h1 className="font-display text-xl font-bold text-center">Connexion</h1>
        {error && <div className="text-sm text-rose-400 bg-rose-950/50 rounded p-2">{error}</div>}
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        />
        <input
          type="password" required placeholder="Mot de passe" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        />
        <button
          type="submit" disabled={busy}
          className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 text-sm font-medium"
        >
          {busy ? '…' : 'Se connecter'}
        </button>
        {needsSetup && (
          <p className="text-center text-sm text-slate-400">
            Première installation ? <Link to="/register" className="text-indigo-400">Créer le compte administrateur</Link>
          </p>
        )}
      </form>
    </div>
  );
}
