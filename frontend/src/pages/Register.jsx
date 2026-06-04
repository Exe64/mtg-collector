import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';

export default function Register() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(email, password, displayName);
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
        <h1 className="text-xl font-bold text-center">Créer un compte</h1>
        {error && <div className="text-sm text-rose-400 bg-rose-950/50 rounded p-2">{error}</div>}
        <input
          type="email" required placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        />
        <input
          type="text" placeholder="Nom affiché (optionnel)" value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        />
        <input
          type="password" required placeholder="Mot de passe (8+, 1 maj, 1 chiffre)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2 text-sm"
        />
        <button
          type="submit" disabled={busy}
          className="w-full rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-2 text-sm font-medium"
        >
          {busy ? '…' : 'Créer le compte'}
        </button>
        <p className="text-center text-sm text-slate-400">
          Déjà un compte ? <Link to="/login" className="text-indigo-400">Se connecter</Link>
        </p>
      </form>
    </div>
  );
}
