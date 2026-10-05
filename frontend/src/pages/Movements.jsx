import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';

const DAYS = [7, 30, 90];
const THRESHOLDS = [10, 20, 50];

function MoveItem({ m, onOpen }) {
  const up = Number(m.pct) >= 0;
  return (
    <li className="flex items-center gap-2 py-1.5 text-sm">
      {m.image_uri_small && <img loading="lazy" src={m.image_uri_small} alt="" className="w-7 rounded-sm" />}
      <button type="button" onClick={() => onOpen(m.scryfall_id)} className="flex-1 min-w-0 text-left hover:text-indigo-300">
        <span className="block truncate">{m.name} <span className="text-xs text-slate-500 uppercase">{m.set_code}</span></span>
        <span className="block text-xs text-slate-400">{m.past_eur} € → {m.current_eur} €</span>
      </button>
      <span className={`text-right font-semibold whitespace-nowrap ${up ? 'text-gain-400' : 'text-rose-400'}`}>
        {up ? '▲' : '▼'} {Math.abs(Number(m.pct))}%
        <span className="block text-xs font-normal">{up ? '+' : ''}{Number(m.diff_eur).toFixed(2)} €</span>
      </span>
    </li>
  );
}

function Column({ title, items, empty, onOpen }) {
  return (
    <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
      <h2 className="text-sm font-semibold text-slate-300 mb-2">
        {title} <span className="text-xs text-slate-500">({items.length})</span>
      </h2>
      {items.length === 0 ? (
        <p className="text-xs text-slate-500">{empty}</p>
      ) : (
        <ul className="divide-y divide-slate-800 max-h-[72vh] overflow-auto pr-1">
          {items.map((m) => <MoveItem key={m.scryfall_id} m={m} onOpen={onOpen} />)}
        </ul>
      )}
    </section>
  );
}

export default function Movements() {
  const openCard = useCardModal((s) => s.open);
  const [days, setDays] = useState(30);
  const [threshold, setThreshold] = useState(20);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api(`/collection/price-movers?days=${days}&threshold=${threshold}&limit=200`)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [days, threshold]);

  return (
    <div>
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-bold">Mouvements de prix</h1>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Période :</span>
            {DAYS.map((d) => (
              <button key={d} type="button" onClick={() => setDays(d)}
                className={`rounded px-2 py-1 ${days === d ? 'bg-slate-600' : 'bg-slate-800 hover:bg-slate-700'}`}>{d} j</button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Seuil :</span>
            {THRESHOLDS.map((t) => (
              <button key={t} type="button" onClick={() => setThreshold(t)}
                className={`rounded px-2 py-1 ${threshold === t ? 'bg-slate-600' : 'bg-slate-800 hover:bg-slate-700'}`}>{t}%</button>
            ))}
          </div>
        </div>
      </header>

      <p className="text-sm text-slate-400 mb-4">
        Variations des cartes possédées sur la période choisie (basé sur l'historique de prix, qui s'enrichit chaque jour).
        Jusqu'à 200 cartes par colonne.
      </p>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : !data ? (
        <div className="text-center text-slate-500 py-12">Pas encore de données.</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Column title="📈 Hausses" items={data.gainers || []} empty="Aucune hausse sur la période." onOpen={openCard} />
          <Column title="📉 Baisses" items={data.losers || []} empty="Aucune baisse sur la période." onOpen={openCard} />
          <Column title={`🚀 Variations ≥ ${threshold}%`} items={data.spikes || []}
            empty="Aucune variation au seuil (ou historique insuffisant)." onOpen={openCard} />
        </div>
      )}
    </div>
  );
}
