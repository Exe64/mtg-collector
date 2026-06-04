import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import CardSearch from '../components/search/CardSearch';
import CollectionTable from '../components/collection/CollectionTable';

export default function Collection() {
  const [data, setData] = useState({ entries: [], total: 0, stats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [grouped, setGrouped] = useState(true);
  const [collapsed, setCollapsed] = useState({});

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api('/collection?sort=value&order=desc&pageSize=200');
      setData(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  async function updateQty(id, quantity) {
    await api(`/collection/${id}`, { method: 'PATCH', body: { quantity } });
    reload();
  }

  async function remove(id) {
    await api(`/collection/${id}`, { method: 'DELETE' });
    reload();
  }

  const groups = useMemo(() => {
    const m = new Map();
    for (const e of data.entries) {
      const key = e.card.set_name || e.card.set || '—';
      if (!m.has(key)) m.set(key, { name: key, code: e.card.set, entries: [], total: 0 });
      const g = m.get(key);
      g.entries.push(e);
      g.total += Number(e.total_price_eur) || 0;
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [data.entries]);

  const stats = data.stats;

  return (
    <div className="max-w-5xl mx-auto">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Ma collection</h1>
        {stats && (
          <div className="text-sm text-slate-400">
            <span className="text-emerald-400 font-semibold">{stats.totalValueEur.toFixed(2)} €</span>
            {' · '}{stats.cardCount} cartes{' · '}{stats.uniqueCardCount} uniques
          </div>
        )}
      </header>

      <CardSearch onAdded={reload} />

      <label className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
        Grouper par extension
      </label>

      {error && <div className="text-sm text-rose-400 mb-2">{error}</div>}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : !grouped ? (
        <CollectionTable entries={data.entries} onUpdateQty={updateQty} onDelete={remove} />
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const isCollapsed = collapsed[g.name];
            return (
              <section key={g.name}>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => ({ ...c, [g.name]: !c[g.name] }))}
                  className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded-md px-3 py-2 mb-1"
                >
                  <span className="text-sm font-medium">
                    <span className="text-slate-500 mr-2">{isCollapsed ? '▸' : '▾'}</span>
                    {g.name} <span className="text-slate-500 uppercase text-xs">({g.code})</span>
                  </span>
                  <span className="text-xs text-slate-400">
                    {g.entries.length} · <span className="text-emerald-400">{g.total.toFixed(2)} €</span>
                  </span>
                </button>
                {!isCollapsed && (
                  <CollectionTable entries={g.entries} onUpdateQty={updateQty} onDelete={remove} />
                )}
              </section>
            );
          })}
          {!groups.length && (
            <div className="text-center text-slate-500 py-12">Aucune carte. Cherche une carte ci-dessus pour commencer.</div>
          )}
        </div>
      )}
    </div>
  );
}
