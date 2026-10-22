import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api/client';
import { CommanderTile, CoverageBar, eur } from './parts';

const SORTS = [
  { value: 'pct', label: '% possédé' },
  { value: 'cost', label: 'Coût pour compléter' },
  { value: 'popular', label: 'Popularité' },
];

export default function CollectionMode({ byId, owned, starred, onStar, onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [sort, setSort] = useState('pct');

  // Le serveur lance le calcul de fond si des decks moyens manquent : on relit
  // toutes les 10 s tant qu'il en reste en attente.
  useEffect(() => {
    let timer;
    let cancelled = false;
    const load = () => api('/commanders/collection')
      .then((r) => {
        if (cancelled) return;
        setData(r);
        if (r.pending > 0 && r.running) timer = setTimeout(load, 10000);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    load();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const rows = useMemo(() => {
    const list = (data?.commanders || []).map((r) => ({ ...r, c: byId.get(r.oracle_id) })).filter((r) => r.c);
    const pct = (r) => r.coverage?.pct ?? -1;
    const cost = (r) => r.coverage?.missingEur ?? Infinity;
    const rank = (r) => r.c.rank ?? Infinity;
    if (sort === 'cost') return list.sort((a, b) => cost(a) - cost(b) || rank(a) - rank(b));
    if (sort === 'popular') return list.sort((a, b) => rank(a) - rank(b));
    return list.sort((a, b) => pct(b) - pct(a) || rank(a) - rank(b));
  }, [data, byId, sort]);

  if (error) return <div className="text-center text-rose-400 py-12">{error}</div>;
  if (!data) return <div className="text-center text-slate-500 py-12">Chargement…</div>;
  if (!rows.length) {
    return <div className="text-center text-slate-500 py-12">Aucune légende pouvant mener un deck dans ta collection pour l'instant.</div>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <span className="text-sm text-slate-400">{rows.length} légende{rows.length > 1 ? 's' : ''} possédée{rows.length > 1 ? 's' : ''}</span>
        <select aria-label="Trier par" value={sort} onChange={(e) => setSort(e.target.value)} className="rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm">
          {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {data.pending > 0 && (
          <span role="status" className="text-sm text-gold-300">
            Calcul en cours : {data.pending} deck{data.pending > 1 ? 's' : ''} moyen{data.pending > 1 ? 's' : ''} à récupérer chez EDHREC (environ 1 par seconde)…
          </span>
        )}
      </div>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {rows.map(({ c, coverage, status }) => (
          <CommanderTile
            key={c.oracle_id} c={c} owned={owned.has(c.oracle_id)} starred={starred.has(c.oracle_id)} onStar={onStar} onOpen={onOpen}
            extra={(
              <span className="block mt-2">
                {coverage ? (
                  <>
                    <span className="flex justify-between text-xs mb-1">
                      <span className="text-slate-200 font-semibold">{coverage.pct} % du deck moyen</span>
                      <span className="text-slate-400">manque <span className="text-emerald-400">{eur(coverage.missingEur)}</span></span>
                    </span>
                    <CoverageBar pct={coverage.pct} />
                  </>
                ) : (
                  <span className="text-xs text-slate-500">
                    {status === 'pending' ? 'Calcul en cours…' : c.pairing === 'background' ? 'Historique : accompagne un commandant' : 'Pas de deck moyen EDHREC'}
                  </span>
                )}
              </span>
            )}
          />
        ))}
      </ul>
    </div>
  );
}
