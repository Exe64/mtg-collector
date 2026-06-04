import { useState, useEffect, useCallback } from 'react';
import { api } from '../api/client';
import CardSearch from '../components/search/CardSearch';
import CollectionTable from '../components/collection/CollectionTable';

export default function Collection() {
  const [data, setData] = useState({ entries: [], total: 0, stats: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

      {error && <div className="text-sm text-rose-400 mb-2">{error}</div>}
      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : (
        <CollectionTable entries={data.entries} onUpdateQty={updateQty} onDelete={remove} />
      )}
    </div>
  );
}
