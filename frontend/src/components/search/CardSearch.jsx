import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';

const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];

export default function CardSearch({ onAdded }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // carte de base (nom)
  const [prints, setPrints] = useState([]); // toutes les éditions
  const [printId, setPrintId] = useState(null); // édition choisie
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
    setPrints([card]); // affichage immédiat avant chargement des éditions
    setForm({ quantity: 1, finish: 'nonfoil', condition: 'NM', language: 'en' });
    setResults([]);
    setQ('');
    try {
      const data = await api(`/cards/prints?name=${encodeURIComponent(card.name)}`);
      if (data.cards?.length) {
        setPrints(data.cards);
        // garde l'édition cliquée si présente, sinon la première
        if (!data.cards.some((p) => p.scryfall_id === card.scryfall_id)) {
          setPrintId(data.cards[0].scryfall_id);
        }
      }
    } catch { /* on garde la carte de base */ }
  }

  const currentPrint = prints.find((p) => p.scryfall_id === printId) || selected;
  const finishes = currentPrint?.finishes?.length ? currentPrint.finishes : ['nonfoil'];

  function changePrint(id) {
    setPrintId(id);
    const p = prints.find((x) => x.scryfall_id === id);
    const avail = p?.finishes?.length ? p.finishes : ['nonfoil'];
    if (!avail.includes(form.finish)) setForm((f) => ({ ...f, finish: avail[0] }));
  }

  async function add() {
    setMsg(null);
    try {
      await api('/collection', {
        method: 'POST',
        body: { scryfall_id: printId, ...form, quantity: Number(form.quantity) },
      });
      setMsg(`✓ ${currentPrint.name} (${currentPrint.set?.toUpperCase()}) ajoutée`);
      setSelected(null);
      setPrints([]);
      onAdded?.();
    } catch (err) {
      setMsg(err.message);
    }
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

      {results.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full max-h-80 overflow-auto bg-slate-800 border border-slate-700 rounded-md shadow-xl">
          {results.map((c) => (
            <li key={c.scryfall_id}>
              <button
                type="button"
                onClick={() => pick(c)}
                className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-slate-700 text-left"
              >
                {c.image_small && <img src={c.image_small} alt="" className="w-8 rounded-sm" />}
                <span className="flex-1 text-sm">{c.name}</span>
                <span className="text-xs text-slate-400 uppercase whitespace-nowrap">{c.set} #{c.collector_number}</span>
                <span className="text-xs text-emerald-400 w-14 text-right">
                  {c.prices?.eur ? `${c.prices.eur} €` : '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && currentPrint && (
        <div className="mt-2 flex flex-wrap items-end gap-2 bg-slate-800 border border-slate-700 rounded-md p-3">
          <div className="flex-1 min-w-[8rem] text-sm font-medium">
            {currentPrint.name}
            <span className="ml-2 text-xs text-emerald-400">
              {currentPrint.prices?.[form.finish === 'foil' ? 'eur_foil' : 'eur'] ?? currentPrint.prices?.eur ?? '—'} €
            </span>
          </div>
          <label className="text-xs text-slate-400">
            Édition
            <select
              value={printId}
              onChange={(e) => changePrint(e.target.value)}
              className="block max-w-[12rem] rounded bg-slate-900 border border-slate-700 px-2 py-1 text-sm"
            >
              {prints.map((p) => (
                <option key={p.scryfall_id} value={p.scryfall_id}>
                  {p.set?.toUpperCase()} #{p.collector_number}
                </option>
              ))}
            </select>
          </label>
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
              {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <button type="button" onClick={add} className="rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1.5 text-sm">
            Ajouter
          </button>
          <button type="button" onClick={() => { setSelected(null); setPrints([]); }} className="text-slate-400 text-sm px-2">
            Annuler
          </button>
        </div>
      )}

      {msg && <div className="mt-2 text-xs text-slate-400">{msg}</div>}
    </div>
  );
}
