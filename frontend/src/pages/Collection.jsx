import { useState, useEffect, useCallback } from 'react';
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

const FINISH_OPTIONS = [['', 'Finition'], ['nonfoil', 'Non foil'], ['foil', 'Foil']];
const EMPTY_FILTERS = { type: '', rarity: '', color: '', cmc: '', condition: '', location: '', finish: '' };
const FINISHES = ['nonfoil', 'foil', 'etched'];
const PAGE_SIZE = 100;   // mode "plat"
const GROUP_PAGE = 500;  // cartes chargées par extension à l'ouverture

const FILTER_LABEL = { type: 'Type', rarity: 'Rareté', color: 'Couleur', cmc: 'Coût de mana' };

export default function Collection() {
  const [stats, setStats] = useState(null);
  const [q, setQ] = useState('');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState('value');
  const [order, setOrder] = useState('desc');
  const [grouped, setGrouped] = useState(true);
  const [groupBy, setGroupBy] = useState('set');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mode plat
  const [flat, setFlat] = useState({ entries: [], total: 0 });
  const [flatPage, setFlatPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  // Mode groupé (serveur)
  const [groups, setGroups] = useState([]);
  const [groupEntries, setGroupEntries] = useState({});
  const [expanded, setExpanded] = useState({});

  const [editing, setEditing] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState({ location: '', condition: '', finish: '', language: '' });

  // Paramètres communs (q + filtres)
  const commonParams = useCallback(() => {
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    if (filters.type) p.set('type', filters.type);
    if (filters.rarity) p.set('rarity', filters.rarity);
    if (filters.color) p.set('color', filters.color);
    if (filters.condition) p.set('condition', filters.condition);
    if (filters.finish) p.set('finish', filters.finish);
    if (filters.location) p.set('location', filters.location);
    if (filters.cmc === '7+') p.set('cmcMin', '7');
    else if (filters.cmc) p.set('cmc', filters.cmc);
    return p.toString();
  }, [q, filters]);

  const fetchGroupEntries = useCallback(async (key) => {
    const p = new URLSearchParams(commonParams());
    p.set(groupBy, key); // set | color | rarity | location (override éventuel du filtre)
    p.set('sort', sort);
    p.set('order', order);
    p.set('pageSize', String(GROUP_PAGE));
    const res = await api(`/collection?${p.toString()}`);
    return res.entries;
  }, [commonParams, sort, order, groupBy]);

  const COLOR_LABELS = Object.fromEntries(COLOR_OPTIONS.slice(1).map(([v, l]) => [v, l]));
  const RARITY_LABELS = Object.fromEntries(RARITY_OPTIONS.slice(1).map(([v, l]) => [v, l]));
  const groupLabel = (g) => {
    if (groupBy === 'set') return `${g.label || g.key} (${(g.key || '').toUpperCase()})`;
    if (groupBy === 'color') return COLOR_LABELS[g.key] || g.key;
    if (groupBy === 'rarity') return RARITY_LABELS[g.key] || g.key || '—';
    return g.key || 'Non classé'; // location
  };

  useEffect(() => {
    api('/collection/locations').then((d) => setLocations(d.locations || [])).catch(() => {});
  }, [stats]);

  // Chargement principal (debounce) — selon le mode
  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        if (grouped) {
          const res = await api(`/collection/groups?by=${groupBy}&${commonParams()}`);
          setGroups(res.groups || []);
          setStats(res.stats);
          // changement de filtre/dimension → on replie tout (réouverture = chargement frais)
          setExpanded({});
          setGroupEntries({});
        } else {
          const res = await api(`/collection?${commonParams()}&sort=${sort}&order=${order}&page=1&pageSize=${PAGE_SIZE}`);
          setFlat(res);
          setStats(res.stats);
          setFlatPage(1);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, filters, sort, order, grouped, groupBy, commonParams]);

  async function toggleGroup(code) {
    const willOpen = !expanded[code];
    setExpanded((e) => ({ ...e, [code]: willOpen }));
    if (willOpen && !groupEntries[code]) {
      const entries = await fetchGroupEntries(code);
      setGroupEntries((g) => ({ ...g, [code]: entries }));
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    try {
      const next = flatPage + 1;
      const res = await api(`/collection?${commonParams()}&sort=${sort}&order=${order}&page=${next}&pageSize=${PAGE_SIZE}`);
      setFlat((d) => ({ ...res, entries: [...d.entries, ...res.entries] }));
      setFlatPage(next);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }

  // Rafraîchit l'affichage après une mutation
  async function refresh() {
    if (grouped) {
      const res = await api(`/collection/groups?by=${groupBy}&${commonParams()}`);
      setGroups(res.groups || []);
      setStats(res.stats);
      const open = Object.keys(expanded).filter((c) => expanded[c]);
      const next = {};
      for (const code of open) {
        // eslint-disable-next-line no-await-in-loop
        next[code] = await fetchGroupEntries(code);
      }
      setGroupEntries(next);
    } else {
      const size = Math.max(flat.entries.length, PAGE_SIZE);
      const res = await api(`/collection?${commonParams()}&sort=${sort}&order=${order}&page=1&pageSize=${size}`);
      setFlat(res);
      setStats(res.stats);
    }
  }

  function onSort(col) {
    if (col === sort) setOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
    else { setSort(col); setOrder(col === 'name' || col === 'set' ? 'asc' : 'desc'); }
  }

  async function update(id, patch) {
    setError(null);
    try {
      await api(`/collection/${id}`, { method: 'PATCH', body: patch });
      await refresh();
    } catch (err) {
      setError(err.message);
      await refresh();
    }
  }

  async function remove(id) {
    await api(`/collection/${id}`, { method: 'DELETE' });
    await refresh();
  }

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
  const hasMore = flat.entries.length < flat.total;
  const tableProps = { onUpdate: update, onDelete: remove, onEdit: setEditing, sort, order, onSort, selected, onToggleSelect: toggleSelect, onSetMany: setMany };
  const isEmpty = grouped ? groups.length === 0 : flat.entries.length === 0;

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="font-display text-xl font-bold">Ma collection</h1>
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
          aria-label="Rechercher dans ma collection"
          className="w-full rounded-md bg-slate-800 border border-edge px-3 py-2 text-sm"
        />
        {q && (
          <button type="button" onClick={() => setQ('')} aria-label="Effacer la recherche"
            className="absolute right-2 top-2 text-slate-500 hover:text-slate-300 text-sm">✕</button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-3">
        {[['type', TYPE_OPTIONS], ['rarity', RARITY_OPTIONS], ['color', COLOR_OPTIONS], ['cmc', CMC_OPTIONS]].map(([key, opts]) => (
          <select key={key} aria-label={FILTER_LABEL[key]} value={filters[key]} onChange={(e) => setFilter(key, e.target.value)}
            className="rounded-md bg-slate-800 border border-edge px-2 py-1.5 text-sm">
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        <select value={filters.condition} onChange={(e) => setFilter('condition', e.target.value)} aria-label="État"
          className="rounded-md bg-slate-800 border border-edge px-2 py-1.5 text-sm">
          <option value="">État</option>
          {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select value={filters.finish} onChange={(e) => setFilter('finish', e.target.value)} aria-label="Finition"
          className="rounded-md bg-slate-800 border border-edge px-2 py-1.5 text-sm">
          {FINISH_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {locations.length > 0 && (
          <select value={filters.location} onChange={(e) => setFilter('location', e.target.value)} aria-label="Emplacement"
            className="rounded-md bg-slate-800 border border-edge px-2 py-1.5 text-sm">
            <option value="">Emplacement</option>
            {locations.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        {hasFilters && (
          <button type="button" onClick={() => { setQ(''); setFilters(EMPTY_FILTERS); }}
            className="text-xs text-slate-400 hover:text-slate-200 px-2">Réinitialiser</button>
        )}
      </div>

      {/* Tri (mobile) — le desktop trie via les en-têtes */}
      <div className="sm:hidden flex items-center gap-2 mb-3">
        <span className="text-xs text-slate-400">Trier :</span>
        <select value={sort} aria-label="Trier par"
          onChange={(e) => { setSort(e.target.value); setOrder(e.target.value === 'name' || e.target.value === 'set' ? 'asc' : 'desc'); }}
          className="rounded-md bg-slate-800 border border-edge px-2 py-1 text-sm">
          <option value="value">Valeur</option>
          <option value="name">Nom</option>
          <option value="type">Type</option>
          <option value="quantity">Quantité</option>
          <option value="rarity">Rareté</option>
          <option value="added_at">Ajout</option>
        </select>
        <button type="button" onClick={() => setOrder((o) => (o === 'asc' ? 'desc' : 'asc'))} aria-label="Inverser l'ordre"
          className="rounded-md bg-slate-800 border border-edge px-2 py-1 text-sm">{order === 'asc' ? '▲' : '▼'}</button>
      </div>

      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={grouped} onChange={(e) => setGrouped(e.target.checked)} />
          Grouper
        </label>
        {grouped && (
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value)} aria-label="Grouper par"
            className="rounded-md bg-slate-800 border border-edge px-2 py-1 text-xs">
            <option value="set">par extension</option>
            <option value="color">par couleur</option>
            <option value="rarity">par rareté</option>
            <option value="location">par emplacement</option>
          </select>
        )}
      </div>

      {selected.size > 0 && (
        <div className="sticky top-0 z-20 bg-slate-700 border border-slate-600 rounded-md p-2 mb-3 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{selected.size} sélectionnée(s)</span>
          <input value={bulk.location} onChange={(e) => setBulk({ ...bulk, location: e.target.value })}
            placeholder="Emplacement" aria-label="Emplacement (masse)"
            className="rounded bg-slate-900 border border-edge px-2 py-1 text-sm w-40" />
          <select value={bulk.condition} onChange={(e) => setBulk({ ...bulk, condition: e.target.value })}
            className="rounded bg-slate-900 border border-edge px-2 py-1 text-sm" aria-label="État (masse)">
            <option value="">État…</option>
            {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={bulk.finish} onChange={(e) => setBulk({ ...bulk, finish: e.target.value })}
            className="rounded bg-slate-900 border border-edge px-2 py-1 text-sm" aria-label="Finition (masse)">
            <option value="">Finition…</option>
            {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <button type="button" onClick={applyBulk} className="rounded bg-indigo-600 hover:bg-indigo-500 text-slate-900 px-3 py-1 text-sm">Appliquer</button>
          <button type="button" onClick={() => setSelected(new Set())} className="text-slate-300 text-sm px-2">Annuler</button>
        </div>
      )}

      {error && <div className="text-sm text-rose-400 mb-2">{error}</div>}

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement…</div>
      ) : isEmpty ? (
        <div className="text-center text-slate-500 py-12">
          {hasFilters ? 'Aucune carte ne correspond aux critères.' : 'Aucune carte. Va dans « Ajouter » pour commencer.'}
        </div>
      ) : grouped ? (
        <div className="space-y-2">
          {groups.map((g) => {
            const open = expanded[g.key];
            const entries = groupEntries[g.key];
            return (
              <section key={g.key || '∅'}>
                <button type="button" onClick={() => toggleGroup(g.key)}
                  className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded-md px-3 py-2">
                  <span className="text-sm font-medium">
                    <span className="text-slate-500 mr-2">{open ? '▾' : '▸'}</span>
                    {groupLabel(g)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {g.count} · <span className="text-emerald-400">{Number(g.total_eur).toFixed(2)} €</span>
                  </span>
                </button>
                {open && (
                  entries
                    ? <div className="mt-1"><CollectionTable entries={entries} {...tableProps} /></div>
                    : <div className="text-center text-slate-500 py-3 text-sm">Chargement…</div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <CollectionTable entries={flat.entries} {...tableProps} />
          {hasMore && (
            <div className="text-center py-4">
              <button type="button" onClick={loadMore} disabled={loadingMore}
                className="rounded-md bg-slate-800 hover:bg-slate-700 border border-edge px-4 py-2 text-sm disabled:opacity-50">
                {loadingMore ? 'Chargement…' : `Charger plus (${flat.entries.length} / ${flat.total})`}
              </button>
            </div>
          )}
        </>
      )}

      {editing && (
        <EntryEditModal entry={editing} onClose={() => setEditing(null)} onSave={(patch) => update(editing.id, patch)} />
      )}
    </div>
  );
}
