import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';

export default function SetDetail() {
  const { code } = useParams();
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState({});
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadOwned = useCallback(async () => {
    const data = await api(`/collection/owned?set=${encodeURIComponent(code)}`);
    setOwned(data.owned || {});
  }, [code]);

  const loadPage = useCallback(async (p) => {
    setLoading(true);
    try {
      const data = await api(`/sets/${encodeURIComponent(code)}/cards?page=${p}`);
      setCards((prev) => (p === 1 ? data.cards : [...prev, ...data.cards]));
      setHasMore(Boolean(data.hasMore));
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, [code]);

  useEffect(() => {
    setCards([]);
    loadPage(1);
    loadOwned();
  }, [code, loadPage, loadOwned]);

  async function adjust(card, delta) {
    // mise à jour optimiste
    setOwned((o) => ({ ...o, [card.scryfall_id]: Math.max((o[card.scryfall_id] || 0) + delta, 0) }));
    try {
      const { quantity } = await api('/collection/adjust', {
        method: 'POST',
        body: { scryfall_id: card.scryfall_id, delta },
      });
      setOwned((o) => ({ ...o, [card.scryfall_id]: quantity }));
    } catch {
      loadOwned(); // resync en cas d'échec
    }
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center gap-2 mb-4">
        <Link to="/sets" className="text-slate-400 hover:text-slate-200 text-sm">← Extensions</Link>
        <h1 className="text-xl font-bold uppercase">{code}</h1>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {cards.map((c) => {
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
                <img src={c.image} alt={c.name} className="w-full" loading="lazy" />
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
      </div>

      {loading && <div className="text-center text-slate-500 py-6">Chargement…</div>}
      {!loading && hasMore && (
        <div className="text-center py-6">
          <button
            type="button" onClick={() => loadPage(page + 1)}
            className="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm"
          >
            Charger plus
          </button>
        </div>
      )}
    </div>
  );
}
