import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';

const TYPES = [
  { value: '', label: 'Tous' },
  { value: 'expansion', label: 'Extensions' },
  { value: 'core', label: 'Éditions de base' },
  { value: 'commander', label: 'Commander' },
  { value: 'masters', label: 'Masters' },
  { value: 'draft_innovation', label: 'Draft innovation' },
  { value: 'promo', label: 'Promos (FNM, Judge…)' },
  { value: 'box', label: 'Coffrets' },
  { value: 'duel_deck', label: 'Duel Decks' },
  { value: 'from_the_vault', label: 'From the Vault' },
  { value: 'masterpiece', label: 'Masterpieces' },
  { value: 'funny', label: 'Un-sets (funny)' },
  { value: 'starter', label: 'Starter' },
  { value: 'token', label: 'Tokens' },
  { value: 'memorabilia', label: 'Memorabilia' },
  { value: 'alchemy', label: 'Alchemy' },
  { value: 'eternal', label: 'Eternal' },
  { value: 'minigame', label: 'Minijeux' },
  { value: 'planechase', label: 'Planechase' },
  { value: 'archenemy', label: 'Archenemy' },
  { value: 'premium_deck', label: 'Premium Decks' },
  { value: 'arsenal', label: 'Arsenal' },
  { value: 'spellbook', label: 'Spellbook' },
  { value: 'treasure_chest', label: 'Treasure Chest' },
  { value: 'vanguard', label: 'Vanguard' },
];

export default function Sets() {
  const [sets, setSets] = useState([]);
  const [ownedBySet, setOwnedBySet] = useState({});
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('expansion');
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [setsData, owned] = await Promise.all([
          api('/sets'),
          api('/collection/owned-by-set').catch(() => ({ ownedBySet: {} })),
        ]);
        setSets(setsData.sets || []);
        setOwnedBySet(owned.ownedBySet || {});
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    return sets
      .filter((s) => (type ? s.set_type === type : true))
      .filter((s) => (q ? s.name.toLowerCase().includes(q.toLowerCase()) : true))
      .sort((a, b) => (b.released_at || '').localeCompare(a.released_at || ''));
  }, [sets, type, q]);

  return (
    <div>
      <h1 className="page-title mb-5">Extensions</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          aria-label="Type d'extension"
          value={type} onChange={(e) => setType(e.target.value)}
          className="rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm"
        >
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer par nom…"
          aria-label="Filtrer par nom"
          className="flex-1 min-w-[10rem] rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
          {filtered.map((s) => {
            const info = ownedBySet[s.code] || {};
            const owned = info.owned || 0;
            const value = info.value || 0;
            const pct = s.card_count ? Math.min(100, Math.round((100 * owned) / s.card_count)) : 0;
            return (
              <Link
                key={s.code} to={`/sets/${s.code}`}
                className="group relative overflow-hidden flex flex-col justify-between min-h-[7.5rem] rounded-tile border border-white/[0.06] bg-gradient-to-br from-slate-800 to-slate-900 hover:border-gold-500/40 p-4"
              >
                {/* Symbole d'extension en filigrane */}
                <i className={`ss ss-${s.code} absolute -right-3 -bottom-4 text-[6.5rem] leading-none text-slate-50/[0.05] group-hover:text-gold-300/10`} aria-hidden="true" />
                <div className="relative flex items-start gap-3">
                  <i className={`ss ss-${s.code} ss-2x shrink-0 ${owned > 0 ? 'text-gold-300' : 'text-slate-400'}`} aria-hidden="true" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display text-lg font-semibold leading-tight text-slate-50 truncate group-hover:text-gold-200">{s.name}</div>
                    <div className="text-[11px] text-slate-400 uppercase tracking-[0.12em] mt-0.5 truncate">
                      {s.code} · {s.card_count ?? '?'} cartes · {s.released_at ? String(s.released_at).slice(0, 10) : '—'}
                    </div>
                  </div>
                </div>
                {owned > 0 && (
                  <div className="relative mt-3">
                    <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                      <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between text-[11px] text-emerald-400 mt-1">
                      <span>{owned}/{s.card_count ?? '?'} · {pct}%</span>
                      {value > 0 && <span className="font-semibold">{value.toFixed(2)} €</span>}
                    </div>
                  </div>
                )}
              </Link>
            );
          })}
          {!filtered.length && <div className="text-slate-500 text-sm">Aucune extension.</div>}
        </div>
      )}
    </div>
  );
}
