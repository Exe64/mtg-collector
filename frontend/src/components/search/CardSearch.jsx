import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';
import { useCardModal } from '../../stores/cardModal';
import { CONDITIONS } from '../../constants';

export default function CardSearch({ onAdded }) {
  const openCard = useCardModal((s) => s.open);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // carte cliquée (nom)
  const [prints, setPrints] = useState([]); // toutes les versions
  const [loadingPrints, setLoadingPrints] = useState(false);
  const [printId, setPrintId] = useState(null); // version choisie
  const [form, setForm] = useState({ quantity: 1, finish: 'nonfoil', condition: 'NM', language: 'en' });
  const [msg, setMsg] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (q.trim().length < 2) { setResults([]); return undefined; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await api(`/cards/search?q=${encodeURIComponent(q.trim())}`);
        setResults(data.cards || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer.current);
  }, [q]);

  async function pick(card) {
    setSelected(card);
    setPrintId(card.scryfall_id);
    setPrints([card]);
    setForm({ quantity: 1, finish: 'nonfoil', condition: 'NM', language: 'en' });
    setResults([]);
    setQ('');
    setMsg(null);
    setLoadingPrints(true);
    try {
      const data = await api(`/cards/prints?name=${encodeURIComponent(card.name)}`);
      if (data.cards?.length) {
        setPrints(data.cards);
        if (!data.cards.some((p) => p.scryfall_id === card.scryfall_id)) {
          setPrintId(data.cards[0].scryfall_id);
        }
      }
    } catch { /* on garde la carte de base */ } finally {
      setLoadingPrints(false);
    }
  }

  const currentPrint = prints.find((p) => p.scryfall_id === printId) || selected;
  const finishes = currentPrint?.finishes?.length ? currentPrint.finishes : ['nonfoil'];

  function choosePrint(p) {
    setPrintId(p.scryfall_id);
    const avail = p.finishes?.length ? p.finishes : ['nonfoil'];
    if (!avail.includes(form.finish)) setForm((f) => ({ ...f, finish: avail[0] }));
  }

  async function add() {
    setMsg(null);
    try {
      await api('/collection', {
        method: 'POST',
        body: { scryfall_id: printId, ...form, quantity: Number(form.quantity) },
      });
      setMsg(`✓ ${currentPrint.name} (${currentPrint.set?.toUpperCase()} #${currentPrint.collector_number}) ajoutée`);
      setSelected(null);
      setPrints([]);
      onAdded?.();
    } catch (err) {
      setMsg(err.message);
    }
  }

  function cancel() {
    setSelected(null);
    setPrints([]);
  }

  return (
    <div className="relative mb-4">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Rechercher une carte…"
        className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-sm"
      />
      {loading && <div className="absolute right-3 top-2.5 text-xs text-slate-500">…</div>}

      {/* Autocomplete : une entrée par carte */}
      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-80 overflow-auto bg-slate-800 border border-slate-700 rounded-md shadow-xl">
          {results.map((c) => (
            <li key={c.scryfall_id} className="flex items-center px-2 hover:bg-slate-700">
              <button
                type="button"
                onClick={() => pick(c)}
                className="flex-1 flex items-center gap-2 py-1.5 text-left min-w-0"
              >
                {c.image_small && <img src={c.image_small} alt="" className="w-8 rounded-sm" />}
                <span className="flex-1 text-sm truncate">{c.name}</span>
                <span className="text-xs text-slate-400 uppercase">{c.set}</span>
              </button>
              <button
                type="button"
                onClick={() => openCard(c.scryfall_id)}
                title="Détails & rulings"
                className="text-slate-400 hover:text-indigo-300 px-2 text-sm"
              >ⓘ</button>
            </li>
          ))}
        </ul>
      )}

      {/* Panneau de sélection de version + ajout */}
      {selected && currentPrint && (
        <div className="mt-2 bg-slate-800 border border-slate-700 rounded-md p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{currentPrint.name}</span>
            <button type="button" onClick={cancel} className="text-slate-400 text-sm">Annuler</button>
          </div>

          {/* Liste des versions */}
          <div>
            <div className="text-xs text-slate-400 mb-1">
              Choisis une version{loadingPrints ? ' (chargement…)' : ` (${prints.length})`}
            </div>
            <ul className="max-h-56 overflow-auto rounded border border-slate-700 divide-y divide-slate-700/60">
              {prints.map((p) => {
                const isSel = p.scryfall_id === printId;
                return (
                  <li key={p.scryfall_id}>
                    <button
                      type="button"
                      onClick={() => choosePrint(p)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 text-left ${isSel ? 'bg-indigo-600/30' : 'hover:bg-slate-700/60'}`}
                    >
                      {p.image_small && <img src={p.image_small} alt="" className="w-7 rounded-sm shrink-0" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm truncate">{p.set_name}</span>
                        <span className="text-xs text-slate-400 uppercase">{p.set} #{p.collector_number}</span>
                      </span>
                      {p.finishes?.includes('foil') && <span className="text-[10px] text-amber-300 shrink-0">foil</span>}
                      <span className="text-xs text-emerald-400 w-16 text-right shrink-0">
                        {p.prices?.eur ? `${p.prices.eur} €` : '—'}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Contrôles d'ajout pour la version choisie */}
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs text-slate-400">
              Qté
              <input
                type="number" min="1" value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                className="block w-16 rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
              />
            </label>
            <label className="text-xs text-slate-400">
              Finition
              <select
                value={form.finish}
                onChange={(e) => setForm({ ...form, finish: e.target.value })}
                className="block rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
              >
                {finishes.map((f) => <option key={f} value={f}>{f}</option>)}
              </select>
            </label>
            <label className="text-xs text-slate-400">
              État
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value })}
                className="block rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
              >
                {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <button type="button" onClick={add} className="rounded bg-indigo-600 hover:bg-indigo-500 px-4 py-1.5 text-sm">
              Ajouter
            </button>
            <button
              type="button"
              onClick={() => openCard(printId)}
              className="text-slate-400 hover:text-indigo-300 text-sm px-1"
            >Détails</button>
          </div>
        </div>
      )}

      {msg && <div className="mt-2 text-xs text-slate-400">{msg}</div>}
    </div>
  );
}
