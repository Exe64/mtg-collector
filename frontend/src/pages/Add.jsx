import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';
import { CONDITIONS, identityStyle } from '../constants';

const ScanModal = lazy(() => import('../components/scan/ScanModal'));

// Logique d'ajout partagée entre la ligne (desktop) et la carte (mobile).
function useAddControls(card) {
  const finishes = card.finishes?.length ? card.finishes : ['nonfoil'];
  const [qty, setQty] = useState(1);
  const [finish, setFinish] = useState(finishes.includes('nonfoil') ? 'nonfoil' : finishes[0]);
  const [condition, setCondition] = useState('NM');
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setStatus(null);
    try {
      await api('/collection', {
        method: 'POST',
        body: { scryfall_id: card.scryfall_id, quantity: Number(qty), finish, condition },
      });
      setStatus('ok');
      setTimeout(() => setStatus(null), 1800);
    } catch (err) {
      setStatus(err.message);
    } finally {
      setBusy(false);
    }
  }
  return { qty, setQty, finish, setFinish, condition, setCondition, status, busy, finishes, add };
}

function FinishSel({ value, onChange, finishes }) {
  return (
    <select value={value} onChange={onChange} aria-label="Finition"
      className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs">
      {finishes.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
  );
}
function CondSel({ value, onChange }) {
  return (
    <select value={value} onChange={onChange} aria-label="État"
      className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs">
      {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
  );
}

// Ligne de résultat (desktop)
function ResultRow({ card }) {
  const openCard = useCardModal((s) => s.open);
  const c = useAddControls(card);
  return (
    <tr style={identityStyle(card.color_identity)} className="border-t border-slate-800 hover:bg-slate-800/40">
      <td className="p-2">
        <button type="button" onClick={() => openCard(card.scryfall_id)} className="flex items-center gap-2 text-left hover:text-indigo-300">
          {card.image_small && <img src={card.image_small} alt="" className="w-9 rounded-sm" />}
          <span className="text-sm">{card.name}</span>
        </button>
      </td>
      <td className="p-2 text-sm">
        <div className="truncate max-w-[14rem]">{card.set_name}</div>
        <div className="text-xs text-slate-500 uppercase">{card.set} #{card.collector_number}</div>
      </td>
      <td className="p-2 text-right text-emerald-400 text-sm whitespace-nowrap">{card.prices?.eur ? `${card.prices.eur} €` : '—'}</td>
      <td className="p-2">
        <input type="number" min="1" value={c.qty} onChange={(e) => c.setQty(e.target.value)} aria-label="Quantité"
          onKeyDown={(e) => { if (e.key === 'Enter') c.add(); }}
          className="w-14 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-right text-sm" />
      </td>
      <td className="p-2"><FinishSel value={c.finish} onChange={(e) => c.setFinish(e.target.value)} finishes={c.finishes} /></td>
      <td className="p-2"><CondSel value={c.condition} onChange={(e) => c.setCondition(e.target.value)} /></td>
      <td className="p-2 whitespace-nowrap">
        <button type="button" onClick={c.add} disabled={c.busy}
          className="rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1 text-sm">Ajouter</button>
        {c.status === 'ok' && <span className="ml-2 text-emerald-400 text-xs">✓</span>}
        {c.status && c.status !== 'ok' && <span className="ml-2 text-rose-400 text-xs">{c.status}</span>}
      </td>
    </tr>
  );
}

// Carte de résultat (mobile)
function ResultCard({ card }) {
  const openCard = useCardModal((s) => s.open);
  const c = useAddControls(card);
  return (
    <li style={identityStyle(card.color_identity)} className="bg-slate-800 border border-slate-700 rounded-lg p-2 pl-3">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => openCard(card.scryfall_id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
          {card.image_small && <img src={card.image_small} alt="" className="w-9 rounded-sm shrink-0" />}
          <span className="min-w-0">
            <span className="block truncate text-sm">{card.name}</span>
            <span className="block text-xs text-slate-500 truncate">{card.set_name} · {card.set?.toUpperCase()} #{card.collector_number}</span>
          </span>
        </button>
        <span className="text-emerald-400 text-sm whitespace-nowrap">{card.prices?.eur ? `${card.prices.eur} €` : '—'}</span>
      </div>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <input type="number" min="1" value={c.qty} onChange={(e) => c.setQty(e.target.value)} aria-label="Quantité"
          onKeyDown={(e) => { if (e.key === 'Enter') c.add(); }}
          className="w-14 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-right text-sm" />
        <FinishSel value={c.finish} onChange={(e) => c.setFinish(e.target.value)} finishes={c.finishes} />
        <CondSel value={c.condition} onChange={(e) => c.setCondition(e.target.value)} />
        <button type="button" onClick={c.add} disabled={c.busy}
          className="ml-auto rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-3 py-1 text-sm">Ajouter</button>
        {c.status === 'ok' && <span className="text-emerald-400 text-xs">✓</span>}
        {c.status && c.status !== 'ok' && <span className="text-rose-400 text-xs w-full">{c.status}</span>}
      </div>
    </li>
  );
}

export default function Add() {
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [showSug, setShowSug] = useState(false);
  const [results, setResults] = useState([]);
  const [lastSearch, setLastSearch] = useState(null); // { term, exact }
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [setF, setSetF] = useState('');
  const [colorF, setColorF] = useState('');
  const timer = useRef(null);

  // Autocomplétion (une entrée par carte)
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setSuggestions([]); return undefined; }
    timer.current = setTimeout(async () => {
      try {
        const data = await api(`/cards/search?q=${encodeURIComponent(q.trim())}`);
        setSuggestions(data.cards || []);
        setShowSug(true);
      } catch {
        setSuggestions([]);
      }
    }, 250);
    return () => clearTimeout(timer.current);
  }, [q]);

  const COLOR_Q = { W: 'w', U: 'u', B: 'b', R: 'r', G: 'g', M: 'm', C: 'c' };

  async function runSearch(term, { exact = false } = {}, pageNum = 1) {
    if (!term.trim()) return;
    setShowSug(false);
    setLoading(true);
    let queryStr = exact ? `!"${term}"` : term.trim();
    if (setF) queryStr += ` set:${setF}`;
    if (colorF) queryStr += ` c:${COLOR_Q[colorF]}`;
    try {
      const data = await api(`/cards/search?q=${encodeURIComponent(queryStr)}&unique=prints&page=${pageNum}`);
      setResults((prev) => (pageNum === 1 ? data.cards : [...prev, ...data.cards]));
      setHasMore(Boolean(data.hasMore));
      setPage(pageNum);
      setLastSearch({ term, exact });
    } finally {
      setLoading(false);
    }
  }

  // Re-déclenche la recherche quand un filtre change (si une recherche est active)
  useEffect(() => {
    if (lastSearch) runSearch(lastSearch.term, { exact: lastSearch.exact }, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setF, colorF]);

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      runSearch(q, { exact: false }, 1);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="font-display text-xl font-bold mb-1">Ajouter des cartes</h1>
      <p className="text-sm text-slate-400 mb-4">
        Tape un nom : choisis une suggestion ou valide avec <kbd className="px-1 bg-slate-700 rounded">Entrée</kbd> pour
        afficher toutes les versions correspondantes, puis ajoute celles que tu veux.
      </p>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            onFocus={() => suggestions.length && setShowSug(true)}
            placeholder="Rechercher une carte…"
            className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
          />
        {showSug && suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full max-h-72 overflow-auto bg-slate-800 border border-slate-700 rounded-md shadow-xl">
            {suggestions.map((c) => (
              <li key={c.scryfall_id}>
                <button
                  type="button"
                  onClick={() => { setQ(c.name); runSearch(c.name, { exact: true }, 1); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 text-left"
                >
                  {c.image_small && <img src={c.image_small} alt="" className="w-7 rounded-sm" />}
                  <span className="flex-1 text-sm truncate">{c.name}</span>
                  <span className="text-xs text-slate-400 uppercase">{c.set}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        </div>
        <button
          type="button"
          onClick={() => setScanOpen(true)}
          title="Scanner une carte"
          aria-label="Scanner une carte"
          className="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-3 text-lg"
        >📷</button>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 -mt-2">
        <input
          value={setF}
          onChange={(e) => setSetF(e.target.value.trim())}
          placeholder="Code extension (ex. MH3)"
          aria-label="Filtrer par extension"
          className="w-44 rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm"
        />
        <select
          value={colorF}
          onChange={(e) => setColorF(e.target.value)}
          aria-label="Filtrer par couleur"
          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm"
        >
          <option value="">Couleur</option>
          <option value="W">Blanc</option>
          <option value="U">Bleu</option>
          <option value="B">Noir</option>
          <option value="R">Rouge</option>
          <option value="G">Vert</option>
          <option value="M">Multicolore</option>
          <option value="C">Incolore</option>
        </select>
        {(setF || colorF) && (
          <button type="button" onClick={() => { setSetF(''); setColorF(''); }} className="text-xs text-slate-400 hover:text-slate-200 px-2">
            Réinitialiser
          </button>
        )}
      </div>

      {scanOpen && (
        <Suspense fallback={null}>
          <ScanModal
            onClose={() => setScanOpen(false)}
            onResult={(text) => { setScanOpen(false); setQ(text); runSearch(text, { exact: false }, 1); }}
          />
        </Suspense>
      )}

      {results.length > 0 && (
        <>
          {/* Mobile : cartes */}
          <ul className="sm:hidden space-y-2">
            {results.map((c) => <ResultCard key={c.scryfall_id} card={c} />)}
          </ul>
          {/* Desktop : tableau */}
          <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="text-left p-2">Carte</th>
                  <th className="text-left p-2">Édition</th>
                  <th className="text-right p-2">Prix</th>
                  <th className="text-left p-2">Qté</th>
                  <th className="text-left p-2">Fin.</th>
                  <th className="text-left p-2">État</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {results.map((c) => <ResultRow key={c.scryfall_id} card={c} />)}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && <div className="text-center text-slate-500 py-6">Recherche…</div>}
      {!loading && hasMore && lastSearch && (
        <div className="text-center py-4">
          <button
            type="button"
            onClick={() => runSearch(lastSearch.term, { exact: lastSearch.exact }, page + 1)}
            className="rounded-md bg-slate-800 hover:bg-slate-700 border border-slate-700 px-4 py-2 text-sm"
          >
            Charger plus
          </button>
        </div>
      )}
      {!loading && lastSearch && results.length === 0 && (
        <div className="text-center text-slate-500 py-8">Aucune carte correspondante.</div>
      )}
    </div>
  );
}
