import { useEffect, useMemo, useState } from 'react';
import { LayoutGrid, List, Shuffle, SlidersHorizontal, X } from 'lucide-react';
import {
  COLORS, COLOR_MODES, PAIRINGS, SORTS, EMPTY_FILTERS,
  activeKeys, applyFilters, relaxSuggestions, sortCommanders, creatureTypes, loadSession, saveSession,
} from './logic';
import { CommanderTile, CommanderRow } from './parts';

const PAGE = 60;
const field = 'rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm';
const COLOR_NAME = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert' };

// Libellé d'une puce de filtre actif
function chipLabel(key, f) {
  switch (key) {
    case 'colors': return `${COLOR_MODES.find((m) => m.value === f.colorMode).label} ${f.colors.join('')}`;
    case 'cmcMax': return `Mana ≤ ${f.cmcMax}`;
    case 'creatureType': return `Type : ${f.creatureType}`;
    case 'pairing': return f.pairing === 'none' ? 'Sans appariement' : PAIRINGS[f.pairing];
    case 'priceMax': return `≤ ${f.priceMax} €`;
    case 'noGameChangers': return 'Sans Game Changers';
    case 'ownedOnly': return 'Dans ma collection';
    case 'q': return `« ${f.q} »`;
    default: return key;
  }
}

export default function Browse({ catalog, owned, starred, onStar, onOpen }) {
  // Filtres, tri et affichage gardés pour l'onglet : le retour depuis une fiche retrouve la liste.
  const [saved] = useState(() => loadSession('cmd:browse', {}));
  const [f, setF] = useState({ ...EMPTY_FILTERS, ...saved.f });
  const [sort, setSort] = useState(saved.sort || 'popular');
  const [view, setView] = useState(saved.view || 'grid');
  const [shown, setShown] = useState(saved.shown || PAGE);
  useEffect(() => { saveSession('cmd:browse', { f, sort, view, shown }); }, [f, sort, view, shown]);
  const [panelOpen, setPanelOpen] = useState(false);

  const set = (patch) => { setF((cur) => ({ ...cur, ...patch })); setShown(PAGE); };
  const clear = (key) => set({ [key]: EMPTY_FILTERS[key] });

  const types = useMemo(() => {
    const count = new Map();
    for (const c of catalog) for (const t of creatureTypes(c.type_line)) count.set(t, (count.get(t) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [catalog]);

  const results = useMemo(() => sortCommanders(applyFilters(catalog, f, owned), sort), [catalog, f, owned, sort]);
  const relax = useMemo(() => (results.length ? [] : relaxSuggestions(catalog, f, owned)), [results, catalog, f, owned]);
  const active = activeKeys(f);

  function surprise() {
    const pool = results.filter((c) => c.pairing !== 'background');
    if (pool.length) onOpen(pool[Math.floor(Math.random() * pool.length)].oracle_id);
  }

  function toggleColor(c) {
    set({ colors: f.colors.includes(c) ? f.colors.filter((x) => x !== c) : [...f.colors, c] });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <input
          type="search"
          value={f.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Nom ou texte de la carte…"
          aria-label="Rechercher un commandant par nom ou texte"
          className={`${field} flex-1 min-w-[12rem]`}
        />
        <select aria-label="Trier par" value={sort} onChange={(e) => setSort(e.target.value)} className={field}>
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <div className="seg" role="group" aria-label="Affichage">
          <button type="button" aria-pressed={view === 'grid'} aria-label="Grille" onClick={() => setView('grid')} className={`seg-btn ${view === 'grid' ? 'seg-btn-on' : ''}`}><LayoutGrid size={14} /></button>
          <button type="button" aria-pressed={view === 'list'} aria-label="Liste" onClick={() => setView('list')} className={`seg-btn ${view === 'list' ? 'seg-btn-on' : ''}`}><List size={14} /></button>
        </div>
        <button type="button" onClick={() => setPanelOpen((o) => !o)} aria-expanded={panelOpen} className="sm:hidden flex items-center gap-1.5 rounded-md bg-slate-700 px-3 py-2 text-sm">
          <SlidersHorizontal size={14} /> Filtres{active.length ? ` (${active.length})` : ''}
        </button>
        <button type="button" onClick={surprise} disabled={!results.length} className="btn-outline flex items-center gap-1.5 disabled:opacity-50">
          <Shuffle size={14} /> Surprenez-moi
        </button>
      </div>

      <section className={`${panelOpen ? 'block' : 'hidden'} sm:block bg-slate-800/50 border border-white/[0.06] rounded-xl p-3 mb-3`}>
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <fieldset>
            <legend className="text-[11px] uppercase tracking-[0.12em] text-slate-400 mb-1">Identité couleur</legend>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORS.map((c) => {
                const on = f.colors.includes(c);
                return (
                  <button
                    key={c} type="button" onClick={() => toggleColor(c)} aria-pressed={on} aria-label={COLOR_NAME[c]}
                    className={`w-11 h-11 sm:w-9 sm:h-9 rounded-full flex items-center justify-center ${on ? 'ring-2 ring-gold-400 bg-slate-700' : 'opacity-50 hover:opacity-90'}`}
                  >
                    <i className={`ms ms-${c.toLowerCase()} ms-cost ms-2x`} aria-hidden="true" />
                  </button>
                );
              })}
              <select aria-label="Mode de couleur" value={f.colorMode} onChange={(e) => set({ colorMode: e.target.value })} className={`${field} ml-1 py-1.5`}>
                {COLOR_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </fieldset>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Mana max
            <select value={f.cmcMax} onChange={(e) => set({ cmcMax: e.target.value })} className={`${field} block mt-1 normal-case tracking-normal`}>
              <option value="">Tous</option>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Type de créature
            <input
              list="cmd-types" value={f.creatureType} onChange={(e) => set({ creatureType: e.target.value })}
              placeholder="Elfe, Dragon…" className={`${field} block mt-1 w-40 normal-case tracking-normal`}
            />
            <datalist id="cmd-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
          </label>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Appariement
            <select value={f.pairing} onChange={(e) => set({ pairing: e.target.value })} className={`${field} block mt-1 normal-case tracking-normal`}>
              <option value="">Tous</option>
              <option value="none">Aucun</option>
              {Object.entries(PAIRINGS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="text-[11px] uppercase tracking-[0.12em] text-slate-400">
            Prix max (€)
            <input
              type="number" min="0" step="1" inputMode="decimal" value={f.priceMax}
              onChange={(e) => set({ priceMax: e.target.value })} className={`${field} block mt-1 w-24 normal-case tracking-normal`}
            />
          </label>
          <div className="flex flex-col gap-1.5 text-sm text-slate-300 pb-1">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.noGameChangers} onChange={(e) => set({ noGameChangers: e.target.checked })} />
              Sans Game Changers
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.ownedOnly} onChange={(e) => set({ ownedOnly: e.target.checked })} />
              Dans ma collection
            </label>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2 mb-3 min-h-[28px]">
        <span className="text-sm text-slate-400 mr-1">{results.length} commandant{results.length > 1 ? 's' : ''}</span>
        {active.map((k) => (
          <button
            key={k} type="button" onClick={() => clear(k)} aria-label={`Retirer le filtre ${chipLabel(k, f)}`}
            className="inline-flex items-center gap-1 rounded-full bg-gold-500/15 text-gold-200 ring-1 ring-inset ring-gold-500/40 pl-2.5 pr-1.5 py-0.5 text-xs hover:bg-gold-500/25"
          >
            {chipLabel(k, f)} <X size={12} />
          </button>
        ))}
        {active.length > 1 && (
          <button type="button" onClick={() => set(EMPTY_FILTERS)} className="text-xs text-slate-400 hover:text-slate-100 underline">Tout effacer</button>
        )}
      </div>

      {!results.length ? (
        <div className="text-center py-12">
          <p className="text-slate-400 mb-3">Aucun commandant ne correspond à ces filtres.</p>
          {relax.length > 0 && (
            <div className="flex flex-wrap justify-center items-center gap-2 text-sm">
              <span className="text-slate-500">Assouplir :</span>
              {relax.map((s) => (
                <button key={s.key} type="button" onClick={() => clear(s.key)} className="rounded-md bg-slate-700 hover:bg-slate-600 px-3 py-1">
                  sans « {chipLabel(s.key, f)} » ({s.count})
                </button>
              ))}
            </div>
          )}
        </div>
      ) : view === 'grid' ? (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {results.slice(0, shown).map((c) => (
            <CommanderTile key={c.oracle_id} c={c} owned={owned.has(c.oracle_id)} starred={starred.has(c.oracle_id)} onStar={onStar} onOpen={onOpen} />
          ))}
        </ul>
      ) : (
        <ul className="rounded-xl border border-white/[0.06] bg-slate-800">
          {results.slice(0, shown).map((c) => (
            <CommanderRow key={c.oracle_id} c={c} owned={owned.has(c.oracle_id)} starred={starred.has(c.oracle_id)} onStar={onStar} onOpen={onOpen} />
          ))}
        </ul>
      )}

      {results.length > shown && (
        <div className="text-center mt-4">
          <button type="button" onClick={() => setShown((n) => n + PAGE)} className="btn-outline">
            Afficher plus ({results.length - shown} restants)
          </button>
        </div>
      )}
    </div>
  );
}
