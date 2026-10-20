import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { api } from '../api/client';
import AuthShell, { authField, PasswordField } from '../components/ui/AuthShell';

export default function Register() {
  const register = useAuth((s) => s.register);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [allowed, setAllowed] = useState(null); // null = en cours, true/false

  useEffect(() => {
    api('/auth/setup-status')
      .then((d) => {
        setAllowed(d.needsSetup);
        if (!d.needsSetup) navigate('/login', { replace: true });
      })
      .catch(() => setAllowed(false));
  }, [navigate]);

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

  if (!allowed) {
    return <AuthShell><p className="text-center text-sm text-slate-400">…</p></AuthShell>;
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-3">
        <h1 className="text-center text-sm font-semibold text-slate-100">Créer le compte administrateur</h1>
        <p className="text-xs text-slate-400 text-center">Première installation : ce compte sera l'administrateur.</p>
        {error && <div role="alert" className="text-sm text-rose-400 bg-rose-950/50 rounded-md p-2 text-center">{error}</div>}
        <input
          type="email" required autoComplete="email" placeholder="Email" aria-label="Email" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={authField}
        />
        <input
          type="text" autoComplete="nickname" placeholder="Nom affiché (optionnel)" aria-label="Nom affiché" value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={authField}
        />
        <PasswordField
          required autoComplete="new-password" placeholder="Mot de passe (8+, 1 maj, 1 chiffre)" aria-label="Mot de passe" value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button type="submit" disabled={busy} className="btn-outline w-full h-10 py-0 font-semibold disabled:opacity-50">
          {busy ? '…' : 'Créer le compte'}
        </button>
        <p className="pt-1 text-center text-xs text-slate-400">
          <Link to="/login" className="text-gold-300 hover:text-gold-200">Se connecter</Link>
        </p>
      </form>
    </AuthShell>
  );
}
