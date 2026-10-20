import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';
import { X } from 'lucide-react';
import { artCrop } from '../constants';

export default function Wishlist() {
  const openCard = useCardModal((s) => s.open);
  const [data, setData] = useState({ items: [], totalEur: 0 });
  const [movers, setMovers] = useState([]);
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

  useEffect(() => {
    api('/wishlist/movers?days=7').then((d) => setMovers(d.movers || [])).catch(() => {});
  }, []);

  async function remove(id) {
    await api(`/wishlist/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="page-title">Liste de souhaits</h1>
        {data.items.length > 0 && (
          <div className="text-sm text-slate-400">
            Coût estimé : <span className="text-emerald-400 font-semibold">{data.totalEur.toFixed(2)} €</span> · {data.items.length} carte(s)
          </div>
        )}
      </header>

      {movers.length > 0 && (
        <section className="mb-4 bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-2">
            ⚡ Mouvements de prix (7 j) <span className="text-xs text-slate-500">— baisses en tête = signaux d'achat</span>
          </h2>
          <ul className="divide-y divide-slate-800">
            {movers.map((m) => {
              const up = Number(m.pct) >= 0;
              return (
                <li key={m.scryfall_id} className="flex items-center gap-2 py-1.5 text-sm">
                  {m.image_uri_small && <img loading="lazy" src={m.image_uri_small} alt="" className="w-7 rounded-sm" />}
                  <button type="button" onClick={() => openCard(m.scryfall_id)} className="flex-1 min-w-0 text-left hover:text-indigo-300">
                    <span className="block truncate">{m.name} <span className="text-xs text-slate-500 uppercase">{m.set_code}</span></span>
                    <span className="block text-xs text-slate-400">{m.past_eur} € → {m.current_eur} €</span>
                  </button>
                  <span className={`text-right font-semibold whitespace-nowrap ${up ? 'text-rose-400' : 'text-gain-400'}`}>
                    {up ? '▲' : '▼'} {Math.abs(Number(m.pct))}%
                    <span className="block text-xs font-normal">{up ? '+' : ''}{Number(m.diff_eur).toFixed(2)} €</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : data.items.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          Liste vide. Ouvre une carte et clique sur « ★ Wishlist » pour l'ajouter.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {data.items.map((it) => (
            <li key={it.id} className="group relative rounded-tile overflow-hidden border border-white/[0.06] bg-slate-800 hover:border-gold-500/40">
              <button type="button" onClick={() => openCard(it.scryfall_id)} className="block w-full text-left">
                <div className="relative aspect-[16/9] bg-slate-700">
                  {it.image_uri_small && (
                    <img loading="lazy" src={artCrop(it.image_uri_small)} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/10 to-transparent" />
                  <span className="glass absolute top-2 right-2 rounded-md px-2 py-0.5 text-xs font-semibold text-emerald-400">
                    {it.eur ? `${it.eur} €` : '—'}
                  </span>
                </div>
                <div className="relative -mt-6 px-3 pb-3">
                  <span className="block truncate font-display text-lg font-semibold leading-snug text-slate-50 group-hover:text-gold-200">{it.name}</span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-slate-400">{it.set_code} · {it.rarity}</span>
                  {it.note && <span className="block text-xs text-slate-400 truncate mt-1">{it.note}</span>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => remove(it.id)}
                aria-label={`Retirer ${it.name}`}
                className="glass absolute top-2 left-2 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-slate-300 hover:text-rose-300"
              ><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
