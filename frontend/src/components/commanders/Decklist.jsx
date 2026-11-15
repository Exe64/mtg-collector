import { useMemo, useState } from 'react';
import { Check, Copy, Hammer, Star } from 'lucide-react';
import { useCardModal } from '../../stores/cardModal';
import { DECK_BUDGETS, DECK_BRACKETS, deckText } from './logic';
import { groupByType } from '../decks/logic';
import { CoverageBar, eur } from './parts';

const field = 'rounded-lg bg-slate-800 border border-edge px-3 py-1.5 text-sm';

/** Choix de la variante EDHREC : tranche de prix, niveau de puissance, thème. */
export function DeckVariantBar({ variant, themes, onChange }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <div className="seg" role="group" aria-label="Prix du deck">
        {DECK_BUDGETS.map(([v, label]) => (
          <button
            key={v || 'avg'} type="button" aria-pressed={variant.budget === v} onClick={() => onChange({ budget: v })}
            className={`seg-btn ${variant.budget === v ? 'seg-btn-on' : ''}`}
          >{label}</button>
        ))}
      </div>
      <select aria-label="Niveau de puissance" value={variant.bracket} onChange={(e) => onChange({ bracket: e.target.value })} className={field}>
        {DECK_BRACKETS.map(([v, label]) => <option key={v || 'all'} value={v}>{label}</option>)}
      </select>
      <select aria-label="Thème du deck" value={variant.theme} onChange={(e) => onChange({ theme: e.target.value })} className={`${field} max-w-[14rem]`}>
        <option value="">Tous les thèmes</option>
        {themes.map((t) => <option key={t.slug} value={t.slug}>{t.name} ({t.count})</option>)}
        {variant.theme && !themes.some((t) => t.slug === variant.theme) && <option value={variant.theme}>{variant.theme}</option>}
      </select>
    </div>
  );
}

/**
 * Deck moyen EDHREC : la liste qui sert au % possédé. Groupée par type,
 * possédées cochées, manquantes atténuées avec leur prix.
 */
export default function Decklist({
  commanderName, deck, coverage, title, numDecks, controls, onBuild, building, buildMsg, onCreate, creating,
}) {
  const openCard = useCardModal((s) => s.open);
  const [missingOnly, setMissingOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const groups = useMemo(
    () => groupByType(missingOnly ? deck.filter((c) => !c.owned && !c.basic) : deck),
    [deck, missingOnly],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(deckText(commanderName, deck));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers refusé : rien à faire */ }
  }

  return (
    <section id="deck" className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4 scroll-mt-20">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display text-2xl font-semibold text-slate-50">{title}</h2>
        <span className="text-sm text-slate-400">{coverage.owned} / {coverage.total} cartes possédées (hors terrains de base)</span>
      </div>
      <p className="text-sm text-slate-400 mb-3">
        La liste type de 99 cartes calculée par EDHREC sur {numDecks ? `${numDecks.toLocaleString('fr-FR')} decks publiés` : 'les decks publiés'} de ce commandant.
        Le pourcentage compare ces cartes à ta collection, par nom, toutes éditions confondues.
      </p>
      {controls}
      <div className="flex items-baseline gap-3 mb-1.5 text-sm">
        <span><span className="text-xl font-semibold text-slate-50">{coverage.pct} %</span> déjà possédé</span>
        {coverage.missing.length > 0 && (
          <span className="text-slate-400">
            {coverage.missing.length} manquante{coverage.missing.length > 1 ? 's' : ''}, environ <span className="text-emerald-400 font-semibold">{eur(coverage.missingEur)}</span>
          </span>
        )}
      </div>
      <CoverageBar pct={coverage.pct} />

      <div className="flex flex-wrap items-center gap-2 mt-4 mb-3">
        <label className="flex items-center gap-2 text-sm text-slate-300 mr-auto">
          <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
          Manquantes seulement
        </label>
        <button type="button" onClick={copy} className="btn-outline flex items-center gap-1.5">
          {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Liste copiée' : 'Copier la liste'}
        </button>
        {onBuild && (
          <button type="button" onClick={onBuild} disabled={building} className="btn-outline flex items-center gap-1.5 disabled:opacity-50">
            <Star size={14} /> {building ? 'Ajout…' : 'Manquantes en wishlist'}
          </button>
        )}
        {onCreate && (
          <button type="button" onClick={onCreate} disabled={creating} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-4 py-2 text-sm">
            <Hammer size={14} /> {creating ? 'Création…' : 'Construire avec'}
          </button>
        )}
      </div>
      {buildMsg && <p role="status" className="text-xs text-slate-300 mb-3">{buildMsg}</p>}

      {!groups.length ? (
        <p className="text-sm text-slate-500 py-6 text-center">Tu possèdes toutes les cartes du deck moyen.</p>
      ) : (
        <div className="columns-1 md:columns-2 xl:columns-3 gap-6">
          {groups.map(([label, cards]) => (
            <div key={label} className="break-inside-avoid mb-4">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 border-b border-white/[0.06] pb-1 mb-1">
                {label} <span className="text-slate-500">({cards.reduce((s, c) => s + c.qty, 0)})</span>
              </h3>
              <ul>
                {cards.map((c) => (
                  <li key={c.name}>
                    <button
                      type="button" onClick={() => c.scryfall_id && openCard(c.scryfall_id)} disabled={!c.scryfall_id}
                      className="w-full flex items-center gap-2 rounded px-1 py-0.5 text-left text-sm hover:bg-white/5"
                    >
                      <span className="w-4 shrink-0 flex justify-center">
                        {c.owned && <Check size={14} className="text-emerald-400" aria-label="Possédée" />}
                      </span>
                      <span className={`flex-1 min-w-0 truncate ${c.owned || c.basic ? 'text-slate-100' : 'text-slate-400'}`}>
                        {c.qty > 1 && <span className="text-slate-500">{c.qty} </span>}{c.name}
                      </span>
                      {c.basic ? (
                        <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500 shrink-0">base</span>
                      ) : !c.owned && (
                        <span className="text-xs text-emerald-400 shrink-0">{eur(c.eur)}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
