import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'owned', label: 'Possédées' },
  { key: 'missing', label: 'Manquantes' },
];

export default function SetDetail() {
  const { code } = useParams();
  const [cards, setCards] = useState([]);
  const [setName, setSetName] = useState('');
  const [owned, setOwned] = useState({});
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const loadOwned = useCallback(async () => {
    const data = await api(`/collection/owned?set=${encodeURIComponent(code)}`);
    setOwned(data.owned || {});
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

  const ownedCount = useMemo(
    () => cards.reduce((n, c) => n + ((owned[c.scryfall_id] || 0) > 0 ? 1 : 0), 0),
    [cards, owned],
  );
  const total = cards.length;
  const pct = total ? Math.round((100 * ownedCount) / total) : 0;

  const visible = useMemo(() => cards.filter((c) => {
    const has = (owned[c.scryfall_id] || 0) > 0;
    if (filter === 'owned') return has;
    if (filter === 'missing') return !has;
    return true;
  }), [cards, owned, filter]);

  const counts = { all: total, owned: ownedCount, missing: total - ownedCount };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-3">
        <Link to="/sets" className="text-slate-400 hover:text-slate-200 text-sm">← Extensions</Link>
        <h1 className="text-xl font-bold">
          {setName || code.toUpperCase()} <span className="text-slate-500 text-sm uppercase">({code})</span>
        </h1>
      </div>

      {/* Complétion */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Complétion</span>
          <span>{ownedCount} / {total} cartes · <span className="text-emerald-400">{pct}%</span></span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
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
                  <img src={c.image} alt={c.name} className={`w-full ${qty > 0 ? '' : 'opacity-60'}`} loading="lazy" />
                ) : (
                  <div className="aspect-[5/7] flex items-center justify-center text-xs text-slate-500 p-2 text-center">{c.name}</div>
                )}
                <div className="p-2">
                  <div className="text-xs truncate" title={c.name}>#{c.collector_number} {c.name}</div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs text-emerald-400">{c.prices?.eur ? `${c.prices.eur} €` : '—'}</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button" onClick={() => adjust(c, -1)} disabled={qty === 0}
                        className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm leading-none"
                      >−</button>
                      <button
                        type="button" onClick={() => adjust(c, 1)}
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
