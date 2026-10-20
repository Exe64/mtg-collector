import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../stores/auth';
import { api } from '../api/client';
import AuthShell, { authField, PasswordField } from '../components/ui/AuthShell';

export default function Login() {
  const login = useAuth((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [mfaStep, setMfaStep] = useState(false);
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
      const r = await login(email, password, mfaStep ? code : undefined);
      if (r.mfaRequired) { setMfaStep(true); return; }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-3">
        <h1 className="sr-only">Connexion</h1>
        <p className="text-xs text-slate-400 text-center">
          {mfaStep ? 'Saisis le code de ton application d’authentification.' : 'Saisis ton email et ton mot de passe.'}
        </p>
        {error && <div role="alert" className="text-sm text-rose-400 bg-rose-950/50 rounded-md p-2 text-center">{error}</div>}
        <input
          type="email" required autoComplete="email" placeholder="vous@exemple.com" aria-label="Email" value={email} disabled={mfaStep}
          onChange={(e) => setEmail(e.target.value)}
          className={authField}
        />
        <PasswordField
          required autoComplete="current-password" placeholder="Mot de passe" aria-label="Mot de passe" value={password} disabled={mfaStep}
          onChange={(e) => setPassword(e.target.value)}
        />
        {mfaStep && (
          <input
            type="text" required autoFocus inputMode="text" autoComplete="one-time-code"
            placeholder="Code (ou code de secours)" aria-label="Code d’authentification" value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${authField} tracking-widest`}
          />
        )}
        <button type="submit" disabled={busy} className="btn-outline w-full h-10 py-0 font-semibold disabled:opacity-50">
          {busy ? '…' : mfaStep ? 'Vérifier' : 'Connexion'}
        </button>
        {needsSetup && (
          <p className="pt-1 text-center text-xs text-slate-400">
            Première installation ? <Link to="/register" className="text-gold-300 hover:text-gold-200">Créer le compte administrateur</Link>
          </p>
        )}
      </form>
    </AuthShell>
  );
}
