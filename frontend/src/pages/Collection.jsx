import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import CollectionTable from '../components/collection/CollectionTable';
import { CONDITIONS } from '../constants';

const TYPE_OPTIONS = [
  ['', 'Type'], ['creature', 'Créature'], ['instant', 'Éphémère'], ['sorcery', 'Rituel'],
  ['artifact', 'Artefact'], ['enchantment', 'Enchantement'], ['planeswalker', 'Planeswalker'],
  ['land', 'Terrain'], ['battle', 'Bataille'],
];
const RARITY_OPTIONS = [
  ['', 'Rareté'], ['common', 'Commune'], ['uncommon', 'Peu commune'], ['rare', 'Rare'], ['mythic', 'Mythique'],
];
const COLOR_OPTIONS = [
  ['', 'Couleur'], ['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert'],
  ['M', 'Multicolore'], ['C', 'Incolore'],
];
const CMC_OPTIONS = [['', 'Coût'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7+', '7+']];

const EMPTY_FILTERS = { type: '', rarity: '', color: '', cmc: '', condition: '' };
const PAGE_SIZE = 100;

export default function Collection() {
  const [data, setData] = useState({ entries: [], total: 0, stats: null });
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [grouped, setGrouped] = useState(true);
  const [collapsed, setCollapsed] = useState({});

  const fetchPage = useCallback(async (search, f, pageNum, size) => {
    const params = new URLSearchParams({
      sort: 'value', order: 'desc', page: String(pageNum), pageSize: String(size),
    });
    if (search) params.set('q', search);
    if (f.type) params.set('type', f.type);
    if (f.rarity) params.set('rarity', f.rarity);
    if (f.color) params.set('color', f.color);
    if (f.condition) params.set('condition', f.condition);
    if (f.cmc === '7+') params.set('cmcMin', '7');
    else if (f.cmc) params.set('cmc', f.cmc);
    return api(`/collection?${params.toString()}`);
  }, []);

  // Première page : à chaque changement de recherche/filtres (debounce)
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchPage(q.trim(), filters, 1, PAGE_SIZE);
        setData(res);
        setPage(1);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, filters, fetchPage]);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await fetchPage(q.trim(), filters, next, PAGE_SIZE);
      setData((d) => ({ ...res, entries: [...d.entries, ...res.entries] }));
      setPage(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // Recharge la même quantité d'entrées déjà affichées (après édition/suppression)
  async function refresh() {
    const size = Math.max(data.entries.length, PAGE_SIZE);
    const res = await fetchPage(q.trim(), filters, 1, size);
    setData(res);
    setPage(Math.max(1, Math.ceil(res.entries.length / PAGE_SIZE)));
  }

  async function update(id, patch) {
    setError(null);
    try {
      await api(`/collection/${id}`, { method: 'PATCH', body: patch });
      await refresh();
    } catch (err) {
      setError(err.message); // ex. conflit 409
      await refresh();
    }
  }

  async function remove(id) {
    await api(`/collection/${id}`, { method: 'DELETE' });
    await refresh();
  }

  const hasMore = data.entries.length < data.total;

  const setFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const hasFilters = q || Object.values(filters).some(Boolean);

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
    <div>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-xl font-bold">Ma collection</h1>
        {stats && (
          <div className="text-sm text-slate-400">
            <span className="text-emerald-400 font-semibold">{stats.totalValueEur.toFixed(2)} €</span>
            {' · '}{stats.cardCount} cartes{' · '}{stats.uniqueCardCount} uniques
          </div>
        )}
      </header>

      <div className="relative mb-3">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Rechercher dans ma collection…"
          className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ('')}
            className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 text-sm"
          >✕</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {[['type', TYPE_OPTIONS], ['rarity', RARITY_OPTIONS], ['color', COLOR_OPTIONS], ['cmc', CMC_OPTIONS]].map(([key, opts]) => (
          <select
            key={key}
            value={filters[key]}
            onChange={(e) => setFilter(key, e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm"
          >
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <select
          value={filters.condition}
          onChange={(e) => setFilter('condition', e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm"
        >
          <option value="">État</option>
          {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setQ(''); setFilters(EMPTY_FILTERS); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2"
          >Réinitialiser</button>
        )}
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
        Grouper par extension
      </label>

      {error && <div className="text-sm text-rose-400 mb-2">{error}</div>}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : data.entries.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          {hasFilters ? 'Aucune carte ne correspond aux critères.' : 'Aucune carte. Va dans « Ajouter » pour commencer.'}
        </div>
      ) : !grouped ? (
        <CollectionTable entries={data.entries} onUpdate={update} onDelete={remove} />
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
                  <CollectionTable entries={g.entries} onUpdate={update} onDelete={remove} />
                )}
              </section>
            );
          })}
        </div>
      )}

      {!loading && hasMore && (
        <div className="text-center py-4">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm disabled:opacity-50"
          >
            {loadingMore ? 'Chargement…' : `Charger plus (${data.entries.length} / ${data.total})`}
          </button>
        </div>
      )}
    </div>
  );
}
