import { Star, Check, Zap, Users } from 'lucide-react';
import { artCrop, identityTint, manaSymbols } from '../../constants';
import { PAIRINGS } from './logic';

/** Barre de couverture : part du deck moyen déjà possédée (bleu jauge). */
export function CoverageBar({ pct }) {
  return (
    <div className="h-2 rounded-full bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

export const eur = (v) => (v === null || v === undefined ? '—' : `${Number(v).toFixed(2)} €`);

export function Mana({ cost, className = '' }) {
  const syms = manaSymbols(cost);
  if (!syms.length) return null;
  return <span className={className}>{syms.map((s, i) => <i key={i} className={`ms ms-${s} ms-cost`} aria-hidden="true" />)}</span>;
}

export function ColorPips({ identity }) {
  const ci = identity?.length ? identity : ['C'];
  return (
    <span className="inline-flex gap-0.5" aria-label={`Identité ${ci.join('')}`}>
      {ci.map((c) => <i key={c} className={`ms ms-${c.toLowerCase()} ms-cost text-[11px]`} aria-hidden="true" />)}
    </span>
  );
}

/** Pastilles d'état : possédé (bleu), Game Changer, appariement. */
export function Badges({ c, owned, className = '' }) {
  return (
    <span className={`flex flex-wrap gap-1 ${className}`}>
      {owned && (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/40 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
          <Check size={10} /> Possédé
        </span>
      )}
      {c.game_changer && (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-500/30 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
          <Zap size={10} /> Game Changer
        </span>
      )}
      {c.pairing && (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-700 text-slate-200 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em]">
          <Users size={10} /> {PAIRINGS[c.pairing]}
        </span>
      )}
    </span>
  );
}

export function StarButton({ on, onToggle, name, className = '' }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      aria-pressed={on}
      aria-label={on ? `Retirer ${name} de la présélection` : `Présélectionner ${name}`}
      className={`glass w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-md ${on ? 'text-gold-300' : 'text-slate-300 hover:text-gold-200'} ${className}`}
    >
      <Star size={16} fill={on ? 'currentColor' : 'none'} />
    </button>
  );
}

/** Tuile de commandant : illustration recadrée, nom gravé, coût, identité, prix. */
export function CommanderTile({ c, owned, starred, onStar, onOpen, extra = null }) {
  return (
    <li className="group relative rounded-tile overflow-hidden border border-white/[0.06] bg-slate-800 hover:border-gold-500/40">
      <button type="button" onClick={() => onOpen(c.oracle_id)} className="block w-full text-left">
        <div className="relative aspect-[16/9] bg-slate-700" style={identityTint(c.color_identity)}>
          {c.image_uri && (
            <img loading="lazy" src={artCrop(c.image_uri)} alt="" className="absolute inset-0 w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/10 to-transparent" />
          <span className="glass absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-semibold text-emerald-400">{eur(c.eur)}</span>
          {c.rank && (
            <span className="glass absolute bottom-7 right-2 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-300">#{c.rank}</span>
          )}
        </div>
        <div className="relative -mt-6 px-3 pb-3">
          <span className="block truncate font-display text-lg font-semibold leading-snug text-slate-50 group-hover:text-gold-200">{c.name}</span>
          <span className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="truncate">{c.type_line?.split(' // ')[0].replace(/^Legendary /, '')}</span>
            <Mana cost={c.mana_cost} className="shrink-0" />
          </span>
          <Badges c={c} owned={owned} className="mt-1.5 min-h-[18px]" />
          {extra}
        </div>
      </button>
      <StarButton on={starred} onToggle={() => onStar(c.oracle_id)} name={c.name} className="absolute top-2 left-2" />
    </li>
  );
}

/** Ligne de commandant (vue liste) : dense, liseré d'identité. */
export function CommanderRow({ c, owned, starred, onStar, onOpen }) {
  return (
    <li className="flex items-center gap-3 border-t border-white/[0.06] first:border-t-0 px-2 py-1.5">
      <StarButton on={starred} onToggle={() => onStar(c.oracle_id)} name={c.name} className="shrink-0 !bg-transparent" />
      <button type="button" onClick={() => onOpen(c.oracle_id)} className="flex-1 min-w-0 flex items-center gap-3 text-left hover:text-gold-200">
        <span className="w-10 text-right text-xs text-slate-500 shrink-0">{c.rank ? `#${c.rank}` : ''}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-slate-100">{c.name}</span>
          <span className="block truncate text-[11px] text-slate-400">{c.type_line?.split(' // ')[0]}</span>
        </span>
        <Badges c={c} owned={owned} className="hidden md:flex" />
        <ColorPips identity={c.color_identity} />
        <span className="w-20 text-right text-sm font-semibold text-emerald-400 shrink-0">{eur(c.eur)}</span>
      </button>
    </li>
  );
}
