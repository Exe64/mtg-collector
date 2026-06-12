import { useState, useEffect, useMemo } from 'react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';

const SOURCE_LABEL = {
  add: 'Ajout',
  adjust: 'Ajustement',
  edit: 'Modification',
  delete: 'Suppression',
  import: 'Import',
};

const PERIODS = [
  { days: 7, label: '7 j' },
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
];

function formatDay(isoDay) {
  const label = new Date(`${isoDay}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function Journal() {
  const [log, setLog] = useState([]);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const openCard = useCardModal((s) => s.open);

  useEffect(() => {
    setLoading(true);
    api(`/collection/log?days=${days}`)
      .then((d) => setLog(d.log || []))
      .catch(() => setLog([]))
      .finally(() => setLoading(false));
  }, [days]);

  // Groupe par jour (fuseau local) ; l'API renvoie déjà du plus récent au plus ancien
  const groups = useMemo(() => {
    const byDay = [];
    for (const row of log) {
      const day = new Date(row.created_at).toLocaleDateString('fr-CA'); // YYYY-MM-DD
      let g = byDay[byDay.length - 1];
      if (!g || g.day !== day) {
        g = { day, rows: [], added: 0, removed: 0 };
        byDay.push(g);
      }
      g.rows.push(row);
      if (row.quantity_delta > 0) g.added += row.quantity_delta;
      else g.removed -= row.quantity_delta;
    }
    return byDay;
  }, [log]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="font-display text-xl font-bold">Journal des modifications</h1>
        <div className="flex gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={`text-xs rounded px-2 py-1 ${days === p.days ? 'bg-slate-600' : 'bg-slate-800 hover:bg-slate-700'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : groups.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucune modification sur la période. Les ajouts et suppressions de cartes apparaîtront ici.
        </p>
      ) : (
        groups.map((g) => (
          <section key={g.day} className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
            <div className="flex items-baseline justify-between flex-wrap gap-1 mb-2">
              <h2 className="text-sm font-semibold text-slate-300">{formatDay(g.day)}</h2>
              <span className="text-xs text-slate-400">
                {g.added > 0 && <span className="text-gain-400">+{g.added} carte{g.added > 1 ? 's' : ''}</span>}
                {g.added > 0 && g.removed > 0 && ' · '}
                {g.removed > 0 && <span className="text-rose-400">−{g.removed} carte{g.removed > 1 ? 's' : ''}</span>}
              </span>
            </div>
            <ul className="divide-y divide-slate-800">
              {g.rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <span className="w-10 text-xs text-slate-500 shrink-0">
                    {new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {r.image_uri_small && <img src={r.image_uri_small} alt="" className="w-7 rounded-sm" />}
                  <button type="button" onClick={() => openCard(r.scryfall_id)} className="flex-1 text-left truncate hover:text-indigo-300">
                    {r.name} <span className="text-xs text-slate-500 uppercase">{r.set_code}</span>
                    {r.finish !== 'nonfoil' && <span className="text-xs text-gold-300"> ★ {r.finish}</span>}
                  </button>
                  <span className="text-xs text-slate-500 hidden sm:inline">{SOURCE_LABEL[r.source] || r.source}</span>
                  <span className={`w-12 text-right font-semibold ${r.quantity_delta > 0 ? 'text-gain-400' : 'text-rose-400'}`}>
                    {r.quantity_delta > 0 ? '+' : '−'}{Math.abs(r.quantity_delta)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
