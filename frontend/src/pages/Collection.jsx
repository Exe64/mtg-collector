import { useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../api/client';
import CollectionTable from '../components/collection/CollectionTable';
import EntryEditModal from '../components/collection/EntryEditModal';
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

const EMPTY_FILTERS = { type: '', rarity: '', color: '', cmc: '', condition: '', location: '' };
const FINISHES = ['nonfoil', 'foil', 'etched'];
const PAGE_SIZE = 100;

export default function Collection() {
  const [data, setData] = useState({ entries: [], total: 0, stats: null });
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('value');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [grouped, setGrouped] = useState(true);
  const [collapsed, setCollapsed] = useState({});
  const [editing, setEditing] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState({ location: '', condition: '', finish: '', language: '' });

  useEffect(() => {
    api('/collection/locations').then((d) => setLocations(d.locations || [])).catch(() => {});
  }, [data.total]);

  const fetchPage = useCallback(async (search, f, pageNum, size) => {
    const params = new URLSearchParams({
      sort, order, page: String(pageNum), pageSize: String(size),
    });
    if (search) params.set('q', search);
    if (f.type) params.set('type', f.type);
    if (f.rarity) params.set('rarity', f.rarity);
    if (f.color) params.set('color', f.color);
    if (f.condition) params.set('condition', f.condition);
    if (f.location) params.set('location', f.location);
    if (f.cmc === '7+') params.set('cmcMin', '7');
    else if (f.cmc) params.set('cmc', f.cmc);
    return api(`/collection?${params.toString()}`);
  }, [sort, order]);

  function onSort(col) {
    if (col === sort) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setOrder(col === 'name' || col === 'set' ? 'asc' : 'desc'); }
  }

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

  const toggleSelect = (id) => setSelected((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });
  const setMany = (ids, value) => setSelected((prev) => {
    const n = new Set(prev);
    ids.forEach((id) => (value ? n.add(id) : n.delete(id)));
    return n;
  });

  async function applyBulk() {
    const patch = {};
    for (const k of ['location', 'condition', 'finish', 'language']) if (bulk[k]) patch[k] = bulk[k];
    if (!Object.keys(patch).length || selected.size === 0) return;
    setError(null);
    try {
      const res = await api('/collection/bulk', { method: 'POST', body: { ids: [...selected], patch } });
      if (res.conflicts) setError(`${res.updated} modifiée(s), ${res.conflicts} en conflit (variante déjà existante)`);
      setSelected(new Set());
      setBulk({ location: '', condition: '', finish: '', language: '' });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

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
            onClick={() => setQ('')} aria-label="Effacer la recherche"
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
        {locations.length > 0 && (
          <select
            value={filters.location}
            onChange={(e) => setFilter('location', e.target.value)}
            className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm"
          >
            <option value="">Emplacement</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => { setQ(''); setFilters(EMPTY_FILTERS); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2"
          >Réinitialiser</button>
        )}
      </div>

      {/* Tri (mobile) — le desktop trie via les en-têtes de colonnes */}
      <div className="sm:hidden flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-400">Trier :</span>
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value); setOrder(e.target.value === 'name' || e.target.value === 'set' ? 'asc' : 'desc'); }}
          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-sm"
        >
          <option value="value">Valeur</option>
          <option value="name">Nom</option>
          <option value="quantity">Quantité</option>
          <option value="rarity">Rareté</option>
          <option value="added_at">Ajout</option>
        </select>
        <button
          type="button"
          onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))}
          aria-label="Inverser l'ordre"
          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1 text-sm"
        >{order === 'asc' ? '▲' : '▼'}</button>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-400 mb-3">
        <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
        Grouper par extension
      </label>

      {selected.size > 0 && (
        <div className="sticky top-0 z-20 bg-slate-700 border border-slate-600 rounded-md p-2 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
          <input
            value={bulk.location} onChange={(e) => setBulk({ ...bulk, location: e.target.value })}
            placeholder="Emplacement" aria-label="Emplacement (masse)"
            className="rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm w-40"
          />
          <select value={bulk.condition} onChange={(e) => setBulk({ ...bulk, condition: e.target.value })}
            className="rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" aria-label="État (masse)">
            <option value="">État…</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={bulk.finish} onChange={(e) => setBulk({ ...bulk, finish: e.target.value })}
            className="rounded bg-slate-900 border border-slate-600 px-2 py-1 text-sm" aria-label="Finition (masse)">
            <option value="">Finition…</option>
            {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button type="button" onClick={applyBulk}
            className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-sm">Appliquer</button>
          <button type="button" onClick={() => setSelected(new Set())}
            className="text-slate-300 text-sm px-2">Annuler</button>
        </div>
      )}

      {error && <div className="text-sm text-rose-400 mb-2">{error}</div>}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : data.entries.length === 0 ? (
        <div className="text-center text-slate-500 py-12">
          {hasFilters ? 'Aucune carte ne correspond aux critères.' : 'Aucune carte. Va dans « Ajouter » pour commencer.'}
        </div>
      ) : !grouped ? (
        <CollectionTable entries={data.entries} onUpdate={update} onDelete={remove} onEdit={setEditing} sort={sort} order={order} onSort={onSort} selected={selected} onToggleSelect={toggleSelect} onSetMany={setMany} />
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
                  <CollectionTable entries={g.entries} onUpdate={update} onDelete={remove} onEdit={setEditing} sort={sort} order={order} onSort={onSort} selected={selected} onToggleSelect={toggleSelect} onSetMany={setMany} />
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

      {editing && (
        <EntryEditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSave={(patch) => update(editing.id, patch)}
        />
      )}
    </div>
  );
}
