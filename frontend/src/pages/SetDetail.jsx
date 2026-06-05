import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'owned', label: 'Possédées' },
  { key: 'missing', label: 'Manquantes' },
];

export default function SetDetail() {
  const { code } = useParams();
  const openCard = useCardModal((s) => s.open);
  const [cards, setCards] = useState([]);
  const [setName, setSetName] = useState('');
  const [cardCount, setCardCount] = useState(null);
  const [printedSize, setPrintedSize] = useState(null);
  const [owned, setOwned] = useState({});
  const [filter, setFilter] = useState('all');
  const [showMissing, setShowMissing] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOwned = useCallback(async () => {
    const data = await api(`/collection/owned?set=${encodeURIComponent(code)}`);
    setOwned(data.owned || {});
  }, [code]);

  // card_count officiel du set (même dénominateur que la liste des extensions)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api('/sets');
        const s = (data.sets || []).find((x) => x.code === code);
        if (!cancelled) {
          setCardCount(s?.card_count ?? null);
          setPrintedSize(s?.printed_size ?? null);
          if (s?.name) setSetName(s.name);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCards([]);
      setFilter('all');
      await loadOwned();
      let page = 1;
      let more = true;
      let all = [];
      let name = '';
      while (more && !cancelled) {
        // eslint-disable-next-line no-await-in-loop
        const data = await api(`/sets/${encodeURIComponent(code)}/cards?page=${page}`);
        all = all.concat(data.cards || []);
        if (data.cards?.[0]?.set_name) name = data.cards[0].set_name;
        more = Boolean(data.hasMore);
        page += 1;
      }
      if (!cancelled) {
        setCards(all);
        setSetName(name);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, loadOwned]);

  async function adjust(card, delta) {
    setOwned((o) => ({ ...o, [card.scryfall_id]: Math.max((o[card.scryfall_id] || 0) + delta, 0) }));
    try {
      const { quantity } = await api('/collection/adjust', {
        method: 'POST',
        body: { scryfall_id: card.scryfall_id, delta },
      });
      setOwned((o) => ({ ...o, [card.scryfall_id]: quantity }));
    } catch {
      loadOwned();
    }
  }

  // Base set strict : cartes au numéro de collecteur ≤ printed_size (hors variants/promos)
  const baseCards = useMemo(() => {
    const limit = printedSize || cardCount || Infinity;
    return cards
      .filter((c) => {
        const n = Number(c.collector_number);
        return Number.isInteger(n) && n >= 1 && n <= limit;
      })
      .sort((a, b) => Number(a.collector_number) - Number(b.collector_number));
  }, [cards, printedSize, cardCount]);

  const ownedCount = baseCards.filter((c) => (owned[c.scryfall_id] || 0) > 0).length;
  const total = baseCards.length || (printedSize ?? cardCount ?? cards.length);
  const pct = total ? Math.min(100, Math.round((100 * ownedCount) / total)) : 0;
  const missingBase = baseCards.filter((c) => !(owned[c.scryfall_id] > 0));

  const visible = useMemo(() => cards.filter((c) => {
    const has = (owned[c.scryfall_id] || 0) > 0;
    if (filter === 'owned') return has;
    if (filter === 'missing') return !has;
    return true;
  }), [cards, owned, filter]);

  // Compteurs des filtres : basés sur les cartes réellement affichées (impressions)
  const ownedDisplayed = cards.filter((c) => (owned[c.scryfall_id] || 0) > 0).length;
  const counts = { all: cards.length, owned: ownedDisplayed, missing: cards.length - ownedDisplayed };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Link to="/sets" className="text-slate-400 hover:text-slate-200 text-sm">← Extensions</Link>
        <h1 className="text-xl font-bold">
          {setName || code.toUpperCase()} <span className="text-slate-500 text-sm uppercase">({code})</span>
        </h1>
      </div>

      {/* Complétion (base set strict) */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Complétion (set de base)</span>
          <span>{ownedCount} / {total} cartes · <span className="text-emerald-400">{pct}%</span></span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        {missingBase.length > 0 && (
          <div className="mt-1">
            <button type="button" onClick={() => setShowMissing((v) => !v)} className="text-xs text-slate-400 hover:text-slate-200">
              {showMissing ? '▾' : '▸'} {missingBase.length} numéro{missingBase.length > 1 ? 's' : ''} manquant{missingBase.length > 1 ? 's' : ''}
            </button>
            {showMissing && (
              <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-auto">
                {missingBase.map((c) => (
                  <button
                    key={c.scryfall_id}
                    type="button"
                    onClick={() => openCard(c.scryfall_id)}
                    title={c.name}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-1.5 py-0.5"
                  >
                    #{c.collector_number}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex gap-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`text-xs rounded px-3 py-1.5 ${filter === f.key ? 'bg-slate-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            {f.label} <span className="text-slate-400">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement de l'extension…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
          {visible.map((c) => {
            const qty = owned[c.scryfall_id] || 0;
            return (
              <div
                key={c.scryfall_id}
                className={`relative rounded-lg overflow-hidden border ${qty > 0 ? 'border-emerald-500' : 'border-slate-700'} bg-slate-800`}
              >
                {qty > 0 && (
                  <span className="absolute top-1 right-1 z-10 bg-emerald-500 text-slate-900 text-xs font-bold rounded-full px-2 py-0.5">
                    ×{qty}
                  </span>
                )}
                {c.image ? (
                  <button type="button" onClick={() => openCard(c.scryfall_id)} className="block w-full">
                    <img src={c.image} alt={c.name} className={`w-full ${qty > 0 ? '' : 'opacity-60'}`} loading="lazy" />
                  </button>
                ) : (
                  <button type="button" onClick={() => openCard(c.scryfall_id)} className="aspect-[5/7] w-full flex items-center justify-center text-xs text-slate-500 p-2 text-center">{c.name}</button>
                )}
                <div className="p-2">
                  <div className="text-xs truncate" title={c.name}>#{c.collector_number} {c.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-emerald-400">{c.prices?.eur ? `${c.prices.eur} €` : '—'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button" onClick={() => adjust(c, -1)} disabled={qty === 0} aria-label="Retirer un exemplaire"
                        className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm leading-none"
                      >−</button>
                      <button
                        type="button" onClick={() => adjust(c, 1)} aria-label="Ajouter un exemplaire"
                        className="w-6 h-6 rounded bg-indigo-600 hover:bg-indigo-500 text-sm leading-none"
                      >+</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {!visible.length && <div className="col-span-full text-center text-slate-500 py-8">Aucune carte dans ce filtre.</div>}
        </div>
      )}
    </div>
  );
}
