import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import Wordmark from './Wordmark';
import Starfield from './Starfield';
import Footer from './Footer';

// Coquille des pages hors connexion : ciel étoilé et nébuleuses, logotype, carte centrale
export default function AuthShell({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col">
      {/* Nébuleuses : voiles très légers aux couleurs du mana, sous les étoiles */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            'radial-gradient(ellipse 45% 35% at 18% 22%, rgba(188,218,247,0.07), transparent 70%)',
            'radial-gradient(ellipse 40% 30% at 82% 30%, rgba(241,155,121,0.06), transparent 70%)',
            'radial-gradient(ellipse 50% 40% at 70% 85%, rgba(159,203,166,0.05), transparent 70%)',
            'radial-gradient(ellipse 35% 30% at 25% 80%, rgba(167,153,158,0.07), transparent 70%)',
            'radial-gradient(ellipse 30% 25% at 50% 50%, rgba(253,251,206,0.035), transparent 70%)',
          ].join(','),
        }}
      />
      <Starfield />

      <main className="relative flex-1 flex flex-col items-center justify-center px-4 py-10">
        <Wordmark size="sm" />
        <div className="mt-7 w-full max-w-[22rem] rounded-xl border border-white/10 bg-slate-800/70 backdrop-blur-md shadow-2xl shadow-black/50 p-5">
          {children}
        </div>
      </main>

      <Footer className="relative px-4 pb-5" />
    </div>
  );
}

// Champ des pages hors connexion : texte centré, comme la référence
export const authField = 'w-full h-10 rounded-lg bg-slate-900/60 border border-edge px-3 text-sm text-center placeholder:text-slate-500 disabled:opacity-50';

// Mot de passe avec bouton afficher / masquer
export function PasswordField(props) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={shown ? 'text' : 'password'} className={authField.replace('px-3', 'px-10')} />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-100"
      >
        {shown ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
