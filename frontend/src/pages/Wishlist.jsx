import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';

export default function Wishlist() {
  const openCard = useCardModal((s) => s.open);
  const [data, setData] = useState({ items: [], totalEur: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api('/wishlist'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function remove(id) {
    await api(`/wishlist/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Liste de souhaits</h1>
        {data.items.length > 0 && (
          <div className="text-sm text-slate-400">
            Coût estimé : <span className="text-emerald-400 font-semibold">{data.totalEur.toFixed(2)} €</span> · {data.items.length} carte(s)
          </div>
        )}
      </header>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : data.items.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          Liste vide. Ouvre une carte et clique sur « ★ Wishlist » pour l'ajouter.
        </div>
      ) : (
        <ul className="rounded-lg border border-slate-800 divide-y divide-slate-800">
          {data.items.map((it) => (
            <li key={it.id} className="flex items-center gap-2 p-2 hover:bg-slate-800/50">
              {it.image_uri_small && <img src={it.image_uri_small} alt="" className="w-9 rounded-sm" />}
              <button type="button" onClick={() => openCard(it.scryfall_id)} className="flex-1 min-w-0 text-left hover:text-indigo-300">
                <span className="block truncate text-sm">{it.name}</span>
                <span className="text-xs text-slate-500 uppercase">{it.set_code} · {it.rarity}</span>
                {it.note && <span className="block text-xs text-slate-500 truncate">{it.note}</span>}
              </button>
              <span className="text-emerald-400 text-sm whitespace-nowrap">{it.eur ? `${it.eur} €` : '—'}</span>
              <button type="button" onClick={() => remove(it.id)} aria-label="Retirer" className="text-rose-400 hover:text-rose-300 px-1">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
