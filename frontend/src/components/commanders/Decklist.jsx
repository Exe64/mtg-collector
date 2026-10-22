import { useMemo, useState } from 'react';
import { Check, Copy, Hammer } from 'lucide-react';
import { useCardModal } from '../../stores/cardModal';
import { DECK_GROUPS, deckGroup, deckText } from './logic';
import { CoverageBar, eur } from './parts';

const ORDER = [...DECK_GROUPS.map(([, label]) => label), 'Autres'];

/**
 * Deck moyen EDHREC : la liste qui sert au % possédé. Groupée par type,
 * possédées cochées, manquantes atténuées avec leur prix.
 */
export default function Decklist({ commanderName, deck, coverage, onBuild, building, buildMsg }) {
  const openCard = useCardModal((s) => s.open);
  const [missingOnly, setMissingOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const groups = useMemo(() => {
    const map = new Map();
    for (const c of deck) {
      if (missingOnly && (c.owned || c.basic)) continue;
      const g = deckGroup(c.type_line);
      if (!map.has(g)) map.set(g, []);
      map.get(g).push(c);
    }
    return ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g).sort((a, b) => a.name.localeCompare(b.name))]);
  }, [deck, missingOnly]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(deckText(commanderName, deck));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers refusé : rien à faire */ }
  }

  return (
    <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="font-display text-2xl font-semibold text-slate-50">Deck moyen EDHREC</h2>
        <span className="text-sm text-slate-400">{coverage.owned} / {coverage.total} cartes possédées (hors terrains de base)</span>
      </div>
      <p className="text-sm text-slate-400 mb-3">
        La liste type de 99 cartes calculée par EDHREC sur les decks publiés de ce commandant.
        Le pourcentage compare ces cartes à ta collection, par nom, toutes éditions confondues.
      </p>
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
          <button type="button" onClick={onBuild} disabled={building} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-4 py-2 text-sm">
            <Hammer size={14} /> {building ? 'Ajout…' : 'Manquantes en wishlist'}
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
