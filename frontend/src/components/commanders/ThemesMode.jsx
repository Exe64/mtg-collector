import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api/client';
import { creatureTypes, sortCommanders } from './logic';
import { CommanderTile } from './parts';

const field = 'rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm';

function Tiles({ list, owned, starred, onStar, onOpen }) {
  if (!list.length) return <div className="text-center text-slate-500 py-12">Aucun commandant légal trouvé.</div>;
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
      {list.map((c) => (
        <CommanderTile key={c.oracle_id} c={c} owned={owned.has(c.oracle_id)} starred={starred.has(c.oracle_id)} onStar={onStar} onOpen={onOpen} />
      ))}
    </ul>
  );
}

export default function ThemesMode({ catalog, byId, theme, typal, setParam, ...tile }) {
  const [sub, setSub] = useState(typal ? 'typal' : 'themes');
  const [themes, setThemes] = useState(null);
  const [themeList, setThemeList] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    api('/commanders/themes').then((r) => setThemes(r.themes)).catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    if (!theme) return undefined;
    let cancelled = false;
    setThemeList(null);
    api(`/commanders/themes/${theme}`)
      .then((r) => { if (!cancelled) setThemeList(r.commanders.map((x) => byId.get(x.oracle_id)).filter(Boolean)); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [theme, byId]);

  const types = useMemo(() => {
    const count = new Map();
    for (const c of catalog) for (const t of creatureTypes(c.type_line)) count.set(t, (count.get(t) || 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [catalog]);

  const needle = q.trim().toLowerCase();
  const back = (
    <button type="button" onClick={() => setParam({ theme: null, typal: null })} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 mb-3">
      <ArrowLeft size={14} /> Tous les {sub === 'typal' ? 'types' : 'thèmes'}
    </button>
  );

  if (theme) {
    const name = themes?.find((t) => t.slug === theme)?.name || theme;
    return (
      <div>
        {back}
        <h2 className="font-display text-2xl font-semibold text-slate-50 mb-1">{name}</h2>
        <p className="text-sm text-slate-400 mb-3">Commandants phares du thème selon EDHREC.</p>
        {error ? <div className="text-rose-400">{error}</div>
          : !themeList ? <div className="text-center text-slate-500 py-12">Chargement…</div>
            : <Tiles list={themeList} {...tile} />}
      </div>
    );
  }

  if (typal) {
    const list = sortCommanders(catalog.filter((c) => creatureTypes(c.type_line).includes(typal)), 'popular');
    return (
      <div>
        {back}
        <h2 className="font-display text-2xl font-semibold text-slate-50 mb-3">{typal} <span className="text-base text-slate-400">({list.length})</span></h2>
        <Tiles list={list} {...tile} />
      </div>
    );
  }

  const items = sub === 'typal'
    ? types.filter(([t]) => !needle || t.toLowerCase().includes(needle)).map(([t, n]) => ({ key: t, label: t, count: `${n} commandant${n > 1 ? 's' : ''}`, go: () => setParam({ typal: t }) }))
    : (themes || []).filter((t) => !needle || t.name.toLowerCase().includes(needle)).map((t) => ({ key: t.slug, label: t.name, count: t.numDecks ? `${t.numDecks.toLocaleString('fr-FR')} decks` : '', go: () => setParam({ theme: t.slug }) }));

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="seg" role="group" aria-label="Thèmes ou types">
          <button type="button" aria-pressed={sub === 'themes'} onClick={() => setSub('themes')} className={`seg-btn ${sub === 'themes' ? 'seg-btn-on' : ''}`}>Thèmes</button>
          <button type="button" aria-pressed={sub === 'typal'} onClick={() => setSub('typal')} className={`seg-btn ${sub === 'typal' ? 'seg-btn-on' : ''}`}>Typal</button>
        </div>
        <input
          type="search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={sub === 'typal' ? 'Elf, Dragon, Zombie…' : 'Tokens, Artefacts, Aristocrates…'}
          aria-label={sub === 'typal' ? 'Filtrer les types de créature' : 'Filtrer les thèmes'}
          className={`${field} flex-1 min-w-[12rem]`}
        />
      </div>
      {sub === 'themes' && error && <div className="text-rose-400 mb-3">EDHREC indisponible : {error}</div>}
      {sub === 'themes' && !themes && !error ? (
        <div className="text-center text-slate-500 py-12">Chargement des thèmes…</div>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2">
          {items.map((it) => (
            <li key={it.key}>
              <button type="button" onClick={it.go} className="w-full text-left rounded-lg border border-white/[0.06] bg-slate-800 hover:border-gold-500/40 px-3 py-2">
                <span className="block truncate text-sm text-slate-100">{it.label}</span>
                <span className="block text-[11px] text-slate-500">{it.count}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
