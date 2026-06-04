import { useState, useEffect } from 'react';
import { api } from '../api/client';
import DonutChart from '../components/charts/DonutChart';
import LineChart from '../components/charts/LineChart';
import { CONDITION_ORDER, CONDITION_LABEL, CONDITION_COLOR } from '../constants';

const COLOR_META = {
  W: { label: 'Blanc', color: '#e9e4b0' },
  U: { label: 'Bleu', color: '#3b82f6' },
  B: { label: 'Noir', color: '#52525b' },
  R: { label: 'Rouge', color: '#ef4444' },
  G: { label: 'Vert', color: '#22c55e' },
  M: { label: 'Multicolore', color: '#eab308' },
  C: { label: 'Incolore', color: '#94a3b8' },
};
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'M', 'C'];

const RARITY_META = {
  common: { label: 'Commune', color: '#94a3b8' },
  uncommon: { label: 'Peu commune', color: '#cbd5e1' },
  rare: { label: 'Rare', color: '#eab308' },
  mythic: { label: 'Mythique', color: '#f97316' },
  special: { label: 'Spéciale', color: '#a855f7' },
  bonus: { label: 'Bonus', color: '#a855f7' },
};

const PERIODS = [
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
  { days: 365, label: '1 an' },
];

function Stat({ label, value, accent }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3">
      <div className="text-xs text-slate-400">{label}</div>
      <div className={`text-lg font-bold ${accent || ''}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [days, setDays] = useState(90);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const s = await api('/collection/stats');
        setStats(s);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const data = await api(`/collection/snapshots?days=${days}`);
      setSnapshots(data.snapshots || []);
    })();
  }, [days]);

  if (loading || !stats) {
    return <div className="text-center text-slate-500 py-12">Chargement…</div>;
  }

  const colorData = COLOR_ORDER
    .map((k) => {
      const row = stats.colorBreakdown.find((r) => r.bucket === k);
      return row ? { label: COLOR_META[k].label, value: row.count, color: COLOR_META[k].color } : null;
    })
    .filter(Boolean);

  const rarityData = stats.rarityBreakdown.map((r) => ({
    label: RARITY_META[r.bucket]?.label || r.bucket,
    value: r.count,
    color: RARITY_META[r.bucket]?.color || '#64748b',
  }));

  const conditionData = CONDITION_ORDER
    .map((k) => {
      const row = (stats.conditionBreakdown || []).find((r) => r.bucket === k);
      return row ? { label: CONDITION_LABEL[k], value: row.count, color: CONDITION_COLOR[k] } : null;
    })
    .filter(Boolean);

  const points = snapshots.map((s) => ({ date: s.snapshot_date, value: s.total_value_eur }));

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <h1 className="text-xl font-bold">Tableau de bord</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Stat label="Valeur (EUR)" value={`${stats.totalValue.eur.toFixed(2)} €`} accent="text-emerald-400" />
        <Stat label="Valeur (USD)" value={`$${stats.totalValue.usd.toFixed(2)}`} />
        <Stat label="Cartes" value={stats.cardCount} />
        <Stat label="Uniques" value={stats.uniqueCardCount} />
        <Stat label="Extensions" value={stats.setCount} />
      </div>

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-300">Évolution de la valeur</h2>
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
        <LineChart points={points} />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par couleur</h2>
          <DonutChart data={colorData} />
        </section>
        <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par rareté</h2>
          <DonutChart data={rarityData} />
        </section>
        <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par état</h2>
          <DonutChart data={conditionData} />
        </section>
      </div>

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Top 10 cartes</h2>
        <ol className="space-y-1">
          {stats.topCards.map((c, i) => (
            <li key={`${c.scryfall_id}-${c.finish}`} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-slate-500 text-xs">{i + 1}.</span>
              {c.image_uri_small && <img src={c.image_uri_small} alt="" className="w-7 rounded-sm" />}
              <span className="flex-1 truncate">{c.name}</span>
              <span className="text-xs text-slate-400 uppercase">{c.set_code}</span>
              <span className="text-xs text-slate-500">×{c.quantity}</span>
              <span className="text-emerald-400 w-20 text-right">{Number(c.total_price_eur).toFixed(2)} €</span>
            </li>
          ))}
          {!stats.topCards.length && <li className="text-slate-500 text-sm">Aucune carte.</li>}
        </ol>
      </section>
    </div>
  );
}
