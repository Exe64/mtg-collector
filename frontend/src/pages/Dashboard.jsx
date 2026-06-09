import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';
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

const TYPE_COLORS = {
  Terrain: '#a16207',
  Créature: '#22c55e',
  Planeswalker: '#a855f7',
  Bataille: '#dc2626',
  Éphémère: '#3b82f6',
  Rituel: '#ef4444',
  Artefact: '#94a3b8',
  Enchantement: '#eab308',
  Autre: '#64748b',
};

const VALUE_ORDER = ['≥ 20 €', '5–19,99 €', '1–4,99 €', '0,10–0,99 €', '< 0,10 €', 'Sans prix'];

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
  const [spikes, setSpikes] = useState([]);
  const [spikeDays, setSpikeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const openCard = useCardModal((s) => s.open);

  useEffect(() => {
    api(`/collection/spikes?days=${spikeDays}&threshold=20`).then((d) => setSpikes(d.spikes || [])).catch(() => {});
  }, [spikeDays]);

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

  const typeData = (stats.typeBreakdown || []).map((r) => ({
    label: r.bucket,
    value: r.count,
    color: TYPE_COLORS[r.bucket] || '#64748b',
  }));

  const valueRows = VALUE_ORDER
    .map((b) => (stats.valueBreakdown || []).find((r) => r.bucket === b))
    .filter(Boolean);
  const maxTierValue = Math.max(1, ...valueRows.map((r) => Number(r.value)));

  const points = snapshots.map((s) => ({ date: s.snapshot_date, value: s.total_value_eur }));

  return (
    <div className="space-y-5">
      <div className="flex items-baseline justify-between flex-wrap gap-2">
        <h1 className="font-display text-xl font-bold">Tableau de bord</h1>
        {stats.pricesUpdatedAt && (
          <span className="text-xs text-slate-500">Prix à jour le {String(stats.pricesUpdatedAt).slice(0, 10)}</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Stat label="Valeur (EUR)" value={`${stats.totalValue.eur.toFixed(2)} €`} accent="text-emerald-400" />
        <Stat label="Valeur (USD)" value={`$${stats.totalValue.usd.toFixed(2)}`} />
        <Stat label="Cartes" value={stats.cardCount} />
        <Stat label="Uniques" value={stats.uniqueCardCount} />
        <Stat label="Extensions" value={stats.setCount} />
      </div>

      {stats.profitability && stats.profitability.pricedCount > 0 && (() => {
        const pf = stats.profitability;
        const up = pf.gain >= 0;
        const Mover = ({ m }) => (
          <li className="flex items-center gap-2 py-1 text-sm">
            {m.image_uri_small && <img src={m.image_uri_small} alt="" className="w-6 rounded-sm" />}
            <button type="button" onClick={() => openCard(m.scryfall_id)} className="flex-1 text-left truncate hover:text-indigo-300">
              {m.name} <span className="text-xs text-slate-500 uppercase">{m.set_code}</span>
            </button>
            <span className={`w-20 text-right ${Number(m.gain) >= 0 ? 'text-gain-400' : 'text-rose-400'}`}>
              {Number(m.gain) >= 0 ? '+' : ''}{Number(m.gain).toFixed(2)} €
            </span>
          </li>
        );
        return (
          <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
            <h2 className="text-sm font-semibold text-slate-300 mb-2">Plus-value <span className="text-xs text-slate-500">({pf.pricedCount} cartes avec prix d'achat)</span></h2>
            <div className="grid grid-cols-3 gap-2 mb-3 text-center">
              <div><div className="text-xs text-slate-400">Investi</div><div className="font-bold">{pf.acquiredTotal.toFixed(2)} €</div></div>
              <div><div className="text-xs text-slate-400">Valeur marché</div><div className="font-bold text-emerald-400">{pf.marketValue.toFixed(2)} €</div></div>
              <div><div className="text-xs text-slate-400">Plus-value</div>
                <div className={`font-bold ${up ? 'text-gain-400' : 'text-rose-400'}`}>
                  {up ? '+' : ''}{pf.gain.toFixed(2)} €{pf.gainPct != null && ` (${up ? '+' : ''}${pf.gainPct}%)`}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-xs text-slate-400 mb-1">Meilleures hausses</h3>
                <ul className="divide-y divide-slate-800">{pf.topGainers.map((m) => <Mover key={`g${m.scryfall_id}`} m={m} />)}</ul>
              </div>
              {pf.topLosers.length > 0 && (
                <div>
                  <h3 className="text-xs text-slate-400 mb-1">Plus fortes baisses</h3>
                  <ul className="divide-y divide-slate-800">{pf.topLosers.map((m) => <Mover key={`l${m.scryfall_id}`} m={m} />)}</ul>
                </div>
              )}
            </div>
          </section>
        );
      })()}

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-300">⚡ Mouvements de prix</h2>
          <div className="flex gap-1">
            {[7, 30].map((d) => (
              <button key={d} type="button" onClick={() => setSpikeDays(d)}
                className={`text-xs rounded px-2 py-1 ${spikeDays === d ? 'bg-slate-600' : 'bg-slate-800 hover:bg-slate-700'}`}>
                {d} j
              </button>
            ))}
          </div>
        </div>
        {spikes.length === 0 ? (
          <p className="text-xs text-slate-500">
            Aucun mouvement ≥ 20% sur la période (ou historique insuffisant — il s'enrichit chaque jour).
          </p>
        ) : (
          <ul className="divide-y divide-slate-800">
            {spikes.map((s) => {
              const up = Number(s.pct) >= 0;
              return (
                <li key={s.scryfall_id} className="flex items-center gap-2 py-1.5 text-sm">
                  {s.image_uri_small && <img src={s.image_uri_small} alt="" className="w-7 rounded-sm" />}
                  <button type="button" onClick={() => openCard(s.scryfall_id)} className="flex-1 text-left truncate hover:text-indigo-300">
                    {s.name} <span className="text-xs text-slate-500 uppercase">{s.set_code}</span>
                  </button>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{s.past_eur} € → {s.current_eur} €</span>
                  <span className={`w-16 text-right font-semibold ${up ? 'text-gain-400' : 'text-rose-400'}`}>
                    {up ? '▲' : '▼'} {Math.abs(Number(s.pct))}%
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

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
        <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par type</h2>
          <DonutChart data={typeData} />
        </section>
      </div>

      <section className="bg-slate-800/40 border border-slate-800 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par valeur (ce qui dort dans les cartons)</h2>
        <ul className="space-y-1.5">
          {valueRows.map((r) => (
            <li key={r.bucket} className="flex items-center gap-2 text-sm">
              <span className="w-24 text-xs text-slate-400 shrink-0">{r.bucket}</span>
              <div className="flex-1 h-3 bg-slate-800 rounded overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${(Number(r.value) / maxTierValue) * 100}%` }} />
              </div>
              <span className="w-16 text-right text-xs text-slate-400 shrink-0">{r.count}</span>
              <span className="w-24 text-right text-emerald-400 shrink-0">{Number(r.value).toFixed(2)} €</span>
            </li>
          ))}
          {!valueRows.length && <li className="text-slate-500 text-sm">Aucune donnée.</li>}
        </ul>
      </section>

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
              <span className="text-emerald-400 w-20 text-right">{Number(c.unit_price_eur).toFixed(2)} €</span>
            </li>
          ))}
          {!stats.topCards.length && <li className="text-slate-500 text-sm">Aucune carte.</li>}
        </ol>
      </section>
    </div>
  );
}
