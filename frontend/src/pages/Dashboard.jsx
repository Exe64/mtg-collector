import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';
import Wordmark, { WUBRG_DOTS } from '../components/ui/Wordmark';
import DonutChart from '../components/charts/DonutChart';
import LineChart from '../components/charts/LineChart';
import { CONDITION_ORDER, CONDITION_LABEL, CONDITION_COLOR, MANA_HEX, artCrop } from '../constants';

const COLOR_META = {
  W: { label: 'Blanc', color: MANA_HEX.W },
  U: { label: 'Bleu', color: MANA_HEX.U },
  B: { label: 'Noir', color: MANA_HEX.B },
  R: { label: 'Rouge', color: MANA_HEX.R },
  G: { label: 'Vert', color: MANA_HEX.G },
  M: { label: 'Multicolore', color: MANA_HEX.M },
  C: { label: 'Incolore', color: MANA_HEX.C },
};
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G', 'M', 'C'];

const RARITY_META = {
  common: { label: 'Commune', color: '#a0a6ae' },
  uncommon: { label: 'Peu commune', color: '#d2d6db' },
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
  Artefact: '#a0a6ae',
  Enchantement: '#eab308',
  Autre: '#565b62',
};

const VALUE_ORDER = ['≥ 20 €', '5–19,99 €', '1–4,99 €', '0,10–0,99 €', '< 0,10 €', 'Sans prix'];

const PERIODS = [
  { days: 30, label: '30 j' },
  { days: 90, label: '90 j' },
  { days: 365, label: '1 an' },
];

const GRANS = [
  { key: 'day', label: 'Jour' },
  { key: 'week', label: 'Semaine' },
  { key: 'month', label: 'Mois' },
  { key: 'year', label: 'Année' },
];
// ponytail: downsample côté client — un point par bucket (le dernier snapshot du bucket).
const BUCKET_KEY = {
  day: (d) => String(d).slice(0, 10),
  week: (d) => String(Math.floor(Date.parse(d) / 604800000)),
  month: (d) => String(d).slice(0, 7),
  year: (d) => String(d).slice(0, 4),
};
function downsample(snaps, gran) {
  if (gran === 'day') return snaps;
  const m = new Map();
  for (const s of snaps) m.set(BUCKET_KEY[gran](s.snapshot_date), s);
  return [...m.values()];
}

// Ordre des pastilles WUBRG
const DOT_COLORS = [['W', 'blanche'], ['U', 'bleue'], ['B', 'noire'], ['R', 'rouge'], ['G', 'verte']];

const SLIDE_MS = 7000;

function Hero({ updatedAt }) {
  const navigate = useNavigate();
  const openCard = useCardModal((s) => s.open);
  const input = useRef(null);
  const [q, setQ] = useState('');
  const [current, setCurrent] = useState(0);
  const [slides, setSlides] = useState([]);

  // Cartes au hasard de la collection (du catalogue si elle est vide), renouvelées à chaque visite
  useEffect(() => {
    api('/collection/hero-arts?limit=12')
      .then((d) => setSlides((d.cards || []).map((c) => ({
        id: c.scryfall_id, name: c.name, art: artCrop(c.image_uri_small), colors: c.color_identity || [],
      }))))
      .catch(() => {});
  }, []);

  // Rotation des illustrations ; figée si l'utilisateur limite les animations.
  // `current` en dépendance : un clic sur une pastille relance le minuteur.
  useEffect(() => {
    if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    const t = setTimeout(() => setCurrent((i) => (i + 1) % slides.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [current, slides.length]);
  const slide = slides[current];

  // « / » place le curseur dans la recherche, sauf si l'on tape déjà ailleurs
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName)) return;
      e.preventDefault();
      input.current?.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const submit = (e) => {
    e.preventDefault();
    navigate(q.trim() ? `/collection?q=${encodeURIComponent(q.trim())}` : '/collection');
  };

  return (
    <div className="relative mx-[calc(50%-50vw)] -mt-6 sm:-mt-8 overflow-hidden">
      {/* Illustrations très floutées, en fondu enchaîné */}
      {slides.map((s, i) => (
        <div
          key={s.id}
          aria-hidden
          className={`absolute inset-0 bg-cover bg-center scale-110 blur-[16px] transition-opacity duration-[1600ms] ease-out motion-reduce:transition-none ${i === current ? 'opacity-80' : 'opacity-0'}`}
          style={{ backgroundImage: `url(${s.art})` }}
        />
      ))}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-slate-900/30 via-slate-900/25 to-slate-900" />

      <div className="relative flex flex-col items-center px-4 pt-10 sm:pt-14 pb-20 sm:pb-24">
        <Wordmark />
        {/* Pastilles WUBRG : s'allument selon les couleurs de la carte affichée ; un clic
            passe à la prochaine carte de cette couleur */}
        <div className="flex mt-5 sm:mt-7">
          {DOT_COLORS.map(([letter, label], k) => {
            const lit = slide?.colors.includes(letter);
            const next = slides.length
              ? [...Array(slides.length).keys()].map((n) => (current + 1 + n) % slides.length)
                .find((j) => slides[j].colors.includes(letter))
              : undefined;
            const dot = (
              <span
                className={`w-1.5 h-1.5 rounded-full transition-transform duration-300 ${lit ? 'scale-[1.7]' : 'opacity-50 group-hover:opacity-100'}`}
                style={{ background: WUBRG_DOTS[k] }}
              />
            );
            return next === undefined ? (
              <span key={letter} aria-hidden className="w-6 h-6 flex items-center justify-center">{dot}</span>
            ) : (
              <button
                key={letter}
                type="button"
                onClick={() => setCurrent(next)}
                aria-label={`Afficher une carte ${label}`}
                aria-pressed={lit}
                className="group w-6 h-6 flex items-center justify-center"
              >{dot}</button>
            );
          })}
        </div>

        <form onSubmit={submit} role="search" className="glass mt-5 sm:mt-7 w-full max-w-2xl rounded-xl border border-white/10 focus-within:border-gold-500/60 shadow-2xl shadow-black/40">
          <label className="flex items-center gap-3 px-4 sm:px-5 h-14 sm:h-16">
            <Search size={20} className="shrink-0 text-slate-400" aria-hidden />
            <input
              ref={input}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher dans ma collection…"
              aria-label="Rechercher dans ma collection"
              className="flex-1 min-w-0 bg-transparent border-0 p-0 text-base text-slate-50 placeholder:text-slate-400 focus:outline-none"
            />
            <kbd className="hidden sm:flex items-center justify-center w-6 h-6 rounded border border-white/20 text-xs text-slate-400 font-sans">/</kbd>
          </label>
        </form>
        {updatedAt && (
          <p className="mt-3 text-xs text-slate-400">Prix à jour le {String(updatedAt).slice(0, 10)}</p>
        )}
        {slide && (
          <button
            type="button"
            onClick={() => openCard(slide.id)}
            className="glass mt-6 sm:mt-8 rounded-full border border-white/10 px-3.5 py-1.5 text-xs text-slate-100 hover:text-gold-200 hover:border-gold-500/40"
          >
            {slide.name}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className="glass border border-white/[0.08] rounded-xl px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{label}</div>
      <div className={`mt-0.5 text-xl font-semibold ${accent || 'text-slate-50'}`}>{value}</div>
    </div>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [days, setDays] = useState(90);
  const [gran, setGran] = useState('day');
  const [movers, setMovers] = useState(null);
  const [spikeDays, setSpikeDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const openCard = useCardModal((s) => s.open);

  useEffect(() => {
    api(`/collection/price-movers?days=${spikeDays}`).then(setMovers).catch(() => {});
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
    color: RARITY_META[r.bucket]?.color || '#565b62',
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
    color: TYPE_COLORS[r.bucket] || '#565b62',
  }));

  const valueRows = VALUE_ORDER
    .map((b) => (stats.valueBreakdown || []).find((r) => r.bucket === b))
    .filter(Boolean);
  const maxTierValue = Math.max(1, ...valueRows.map((r) => Number(r.value)));

  const points = downsample(snapshots, gran).map((s) => ({ date: s.snapshot_date, value: s.total_value_eur }));

  return (
    <div className="space-y-5">
      <Hero updatedAt={stats.pricesUpdatedAt} />

      <div className="relative !-mt-12 sm:!-mt-14 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <Stat label="Valeur (Cardmarket €)" value={`${stats.totalValue.eur.toFixed(2)} €`} accent="text-emerald-400" />
        <Stat label="Valeur (TCGplayer $)" value={`$${stats.totalValue.usd.toFixed(2)}`} />
        <Stat label="Cartes" value={stats.cardCount} />
        <Stat label="Uniques" value={stats.uniqueCardCount} />
        <Stat label="Extensions" value={stats.setCount} />
      </div>

      {stats.profitability && stats.profitability.pricedCount > 0 && (() => {
        const pf = stats.profitability;
        const up = pf.gain >= 0;
        const Mover = ({ m }) => (
          <li className="flex items-center gap-2 py-1 text-sm">
            {m.image_uri_small && <img loading="lazy" src={m.image_uri_small} alt="" className="w-6 rounded-sm" />}
            <button type="button" onClick={() => openCard(m.scryfall_id)} className="flex-1 text-left truncate hover:text-indigo-300">
              {m.name} <span className="text-xs text-slate-500 uppercase">{m.set_code}</span>
            </button>
            <span className={`w-20 text-right ${Number(m.gain) >= 0 ? 'text-gain-400' : 'text-rose-400'}`}>
              {Number(m.gain) >= 0 ? '+' : ''}{Number(m.gain).toFixed(2)} €
            </span>
          </li>
        );
        return (
          <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
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

      <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-300">
            ⚡ Mouvements de prix
            <Link to="/movements" className="ml-2 text-xs font-normal text-indigo-400 hover:text-indigo-300">tout voir →</Link>
          </h2>
          <div className="seg">
            {[7, 30].map((d) => (
              <button key={d} type="button" onClick={() => setSpikeDays(d)}
                aria-pressed={spikeDays === d} className={`seg-btn ${spikeDays === d ? 'seg-btn-on' : ''}`}>
                {d} j
              </button>
            ))}
          </div>
        </div>
        {(() => {
          const MoveItem = ({ m }) => {
            const up = Number(m.pct) >= 0;
            return (
              <li className="flex items-center gap-2 py-1.5 text-sm">
                {m.image_uri_small && <img loading="lazy" src={m.image_uri_small} alt="" className="w-7 rounded-sm" />}
                <button type="button" onClick={() => openCard(m.scryfall_id)} className="flex-1 min-w-0 text-left hover:text-indigo-300">
                  <span className="block truncate">{m.name} <span className="text-xs text-slate-500 uppercase">{m.set_code}</span></span>
                  <span className="block text-xs text-slate-400">{m.past_eur} € → {m.current_eur} €</span>
                </button>
                <span className={`text-right font-semibold whitespace-nowrap ${up ? 'text-gain-400' : 'text-rose-400'}`}>
                  {up ? '▲' : '▼'} {Math.abs(Number(m.pct))}%
                  <span className="block text-xs font-normal">{up ? '+' : ''}{Number(m.diff_eur).toFixed(2)} €</span>
                </span>
              </li>
            );
          };
          const MoveColumn = ({ title, items, empty }) => (
            <div>
              <h3 className="text-xs text-slate-400 mb-1">{title}</h3>
              {items.length === 0 ? (
                <p className="text-xs text-slate-500">{empty}</p>
              ) : (
                <ul className="divide-y divide-slate-800">
                  {items.map((m) => <MoveItem key={m.scryfall_id} m={m} />)}
                </ul>
              )}
            </div>
          );
          return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MoveColumn title="📈 Top 10 hausses" items={movers?.gainers || []} empty="Aucune hausse sur la période." />
              <MoveColumn title="📉 Top 10 baisses" items={movers?.losers || []} empty="Aucune baisse sur la période." />
              <MoveColumn
                title="🚀 Variations notables"
                items={movers?.spikes || []}
                empty="Aucun mouvement ≥ 20% (ou historique insuffisant — il s'enrichit chaque jour)."
              />
            </div>
          );
        })()}
      </section>

      <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-slate-300">Évolution de la valeur</h2>
          <div className="flex flex-wrap gap-2">
            <div className="seg">
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  type="button"
                  onClick={() => setDays(p.days)}
                  aria-pressed={days === p.days} className={`seg-btn ${days === p.days ? 'seg-btn-on' : ''}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="seg">
              {GRANS.map((g) => (
                <button
                  key={g.key}
                  type="button"
                  onClick={() => setGran(g.key)}
                  aria-pressed={gran === g.key} className={`seg-btn ${gran === g.key ? 'seg-btn-on' : ''}`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <LineChart points={points} />
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par couleur</h2>
          <DonutChart data={colorData} />
        </section>
        <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par rareté</h2>
          <DonutChart data={rarityData} />
        </section>
        <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par état</h2>
          <DonutChart data={conditionData} />
        </section>
        <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
          <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par type</h2>
          <DonutChart data={typeData} />
        </section>
      </div>

      <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Répartition par valeur</h2>
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

      <section className="bg-slate-800/50 border border-white/[0.06] rounded-xl p-4">
        <h2 className="text-sm font-semibold text-slate-300 mb-3">Top 10 cartes</h2>
        <ol className="space-y-1">
          {stats.topCards.map((c, i) => (
            <li key={`${c.scryfall_id}-${c.finish}`} className="flex items-center gap-2 text-sm">
              <span className="w-5 text-slate-500 text-xs">{i + 1}.</span>
              {c.image_uri_small && <img loading="lazy" src={c.image_uri_small} alt="" className="w-7 rounded-sm" />}
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
