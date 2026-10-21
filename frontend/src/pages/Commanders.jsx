import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { X, Columns3 } from 'lucide-react';
import { api } from '../api/client';
import { artCrop } from '../constants';
import Browse from '../components/commanders/Browse';
import CollectionMode from '../components/commanders/CollectionMode';
import ThemesMode from '../components/commanders/ThemesMode';
import Matchmaker from '../components/commanders/Matchmaker';
import CommanderPanel from '../components/commanders/CommanderPanel';
import CompareModal from '../components/commanders/CompareModal';

const MODES = [
  { value: 'browse', label: 'Parcourir' },
  { value: 'collection', label: 'Ma collection' },
  { value: 'themes', label: 'Thèmes / Typal' },
  { value: 'match', label: 'Matchmaker' },
];

export default function Commanders() {
  const [params, setParams] = useSearchParams();
  const mode = MODES.some((m) => m.value === params.get('mode')) ? params.get('mode') : 'browse';
  const openId = params.get('c');
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [notice, setNotice] = useState(null);
  const [comparing, setComparing] = useState(false);

  useEffect(() => {
    Promise.all([api('/commanders'), api('/commanders/shortlist').catch(() => ({ shortlist: [] }))])
      .then(([cat, sl]) => { setData(cat); setShortlist(sl.shortlist); })
      .catch((e) => setError(e.message));
  }, []);

  const catalog = useMemo(() => data?.commanders || [], [data]);
  const byId = useMemo(() => new Map(catalog.map((c) => [c.oracle_id, c])), [catalog]);
  const owned = useMemo(() => new Set(data?.owned || []), [data]);
  const starred = useMemo(() => new Set(shortlist), [shortlist]);

  const setParam = useCallback((patch) => {
    setParams((cur) => {
      const next = new URLSearchParams(cur);
      for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
      return next;
    });
  }, [setParams]);
  const open = useCallback((id) => setParam({ c: id }), [setParam]);

  const toggleStar = useCallback(async (id) => {
    setNotice(null);
    try {
      if (starred.has(id)) {
        setShortlist((s) => s.filter((x) => x !== id));
        await api(`/commanders/shortlist/${id}`, { method: 'DELETE' });
      } else {
        await api('/commanders/shortlist', { method: 'POST', body: { oracle_id: id } });
        setShortlist((s) => [...s, id]);
      }
    } catch (e) {
      setNotice(e.message);
      api('/commanders/shortlist').then((sl) => setShortlist(sl.shortlist)).catch(() => {});
    }
  }, [starred]);

  const shared = { catalog, byId, owned, starred, onStar: toggleStar, onOpen: open };
  const picks = shortlist.map((id) => byId.get(id)).filter(Boolean);

  return (
    <div className={picks.length ? 'pb-20' : ''}>
      <header className="mb-4">
        <h1 className="page-title mb-1">Trouver un commandant</h1>
        <p className="text-sm text-slate-400">
          Parmi tous les commandants légaux ou les légendes de ta collection. Popularité et decks moyens : EDHREC ; combos : Commander Spellbook.
        </p>
      </header>

      <div className="seg mb-4" role="group" aria-label="Mode">
        {MODES.map((m) => (
          <button
            key={m.value} type="button" aria-pressed={mode === m.value}
            onClick={() => setParam({ mode: m.value === 'browse' ? null : m.value, theme: null, typal: null })}
            className={`seg-btn ${mode === m.value ? 'seg-btn-on' : ''}`}
          >{m.label}</button>
        ))}
      </div>

      {notice && <div role="status" className="text-sm text-rose-400 mb-3">{notice}</div>}

      {error ? (
        <div className="text-center text-rose-400 py-12">{error}</div>
      ) : !data ? (
        <div className="text-center text-slate-500 py-12">Chargement du catalogue…</div>
      ) : !catalog.length ? (
        <div className="text-center text-slate-400 py-12 max-w-lg mx-auto">
          Catalogue vide : les données Commander des cartes ne sont pas encore synchronisées.
          Un administrateur doit relancer la synchronisation des cartes (Administration → Sync bulk).
        </div>
      ) : mode === 'collection' ? (
        <CollectionMode {...shared} />
      ) : mode === 'themes' ? (
        <ThemesMode {...shared} theme={params.get('theme')} typal={params.get('typal')} setParam={setParam} />
      ) : mode === 'match' ? (
        <Matchmaker {...shared} />
      ) : (
        <Browse {...shared} />
      )}

      {picks.length > 0 && (
        <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] sm:bottom-4 inset-x-0 z-20 flex justify-center px-4 pointer-events-none">
          <div className="glass pointer-events-auto flex items-center gap-2 rounded-tile border border-white/10 shadow-2xl shadow-black/50 p-2 max-w-full">
            <span className="hidden md:block text-[11px] uppercase tracking-[0.12em] text-slate-400 px-1">Présélection {picks.length}/4</span>
            <ul className="flex gap-2 min-w-0 overflow-x-auto">
              {picks.map((c) => (
                <li key={c.oracle_id} className="relative shrink-0">
                  <button type="button" onClick={() => open(c.oracle_id)} title={c.name} className="block w-16 sm:w-24 aspect-[16/9] rounded-md overflow-hidden bg-slate-700">
                    {c.image_uri && <img src={artCrop(c.image_uri)} alt={c.name} className="w-full h-full object-cover" />}
                  </button>
                  <button
                    type="button" onClick={() => toggleStar(c.oracle_id)} aria-label={`Retirer ${c.name} de la présélection`}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-slate-900 border border-white/20 flex items-center justify-center text-slate-300 hover:text-rose-300"
                  ><X size={11} /></button>
                </li>
              ))}
            </ul>
            <button
              type="button" onClick={() => setComparing(true)} disabled={picks.length < 2}
              className="shrink-0 flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-3 py-2 text-sm"
            >
              <Columns3 size={14} /> Comparer
            </button>
          </div>
        </div>
      )}

      {openId && (
        <CommanderPanel
          key={openId}
          id={openId}
          {...shared}
          onClose={() => setParam({ c: null })}
          onTheme={(slug) => setParam({ mode: 'themes', theme: slug, typal: null, c: null })}
        />
      )}
      {comparing && <CompareModal picks={picks} owned={owned} onOpen={(id) => { setComparing(false); open(id); }} onClose={() => setComparing(false)} />}
    </div>
  );
}
