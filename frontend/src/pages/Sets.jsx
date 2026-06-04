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
    <div className="max-w-5xl mx-auto">
      <h1 className="text-xl font-bold mb-4">Extensions</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          value={type} onChange={(e) => setType(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
        >
          {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <input
          value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Filtrer par nom…"
          className="flex-1 min-w-[10rem] rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
        />
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((s) => {
            const owned = ownedBySet[s.code] || 0;
            const pct = s.card_count ? Math.min(100, Math.round((100 * owned) / s.card_count)) : 0;
            return (
              <Link
                key={s.code} to={`/sets/${s.code}`}
                className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg p-3"
              >
                {s.icon && <img src={s.icon} alt="" className="w-6 h-6 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-xs text-slate-400 uppercase">
                    {s.code} · {s.card_count ?? '?'} cartes · {s.released_at || '—'}
                  </div>
                  {owned > 0 && (
                    <div className="mt-1.5">
                      <div className="h-1 rounded-full bg-slate-700 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="text-[10px] text-emerald-400 mt-0.5">
                        {owned}/{s.card_count ?? '?'} · {pct}%
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
          {!filtered.length && <div className="text-slate-500 text-sm">Aucune extension.</div>}
        </div>
      )}
    </div>
  );
}
