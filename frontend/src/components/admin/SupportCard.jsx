import { Heart } from 'lucide-react';
import { AUTHOR_LINKS } from '../../constants';

const btn = 'inline-flex items-center gap-2.5 rounded-lg border h-11 pl-2 pr-4 text-sm font-medium';
const ext = { target: '_blank', rel: 'noopener noreferrer' };

// Encart « Soutenir le projet » de l'administration : texte à gauche, boutons à droite
export default function SupportCard() {
  return (
    <section className="bg-gold-500/[0.06] border border-gold-500/20 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="flex-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-gold-300 mb-2">
          <Heart size={15} /> Soutenir le projet
        </h2>
        <p className="text-sm text-slate-300 max-w-prose">
          MTG Collector est développé et maintenu gratuitement, sur mon temps libre, sans publicité
          ni collecte de données. Si l'outil vous rend service, vous pouvez soutenir son développement
          par un don : il finance le temps passé à corriger, améliorer et publier de nouvelles versions.
        </p>
      </div>
      <div className="flex flex-wrap sm:flex-col gap-2 shrink-0">
        <a href={AUTHOR_LINKS.kofi} {...ext} className={`${btn} border-gold-500/40 text-gold-200 hover:bg-gold-500/10`}>
          <img src="/brands/kofi.png" alt="" width="28" height="28" className="rounded-md" />
          Ko-fi
        </a>
        <a href={AUTHOR_LINKS.paypal} {...ext} className={`${btn} border-white/15 text-slate-200 hover:bg-white/5`}>
          <span className="w-7 h-7 rounded-md bg-white flex items-center justify-center">
            <img src="/brands/paypal.png" alt="" width="17" height="20" />
          </span>
          PayPal
        </a>
      </div>
    </section>
  );
}
