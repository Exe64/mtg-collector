import { useState, useEffect, useRef } from 'react';
import { api } from '../../api/client';

const FINISHES = ['nonfoil', 'foil', 'etched'];
const CONDITIONS = ['NM', 'LP', 'MP', 'HP', 'DMG'];

export default function CardSearch({ onAdded }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
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

  function pick(card) {
    setSelected(card);
    setForm({
      quantity: 1,
      finish: card.finishes?.includes('nonfoil') === false && card.finishes?.[0] ? card.finishes[0] : 'nonfoil',
      condition: 'NM',
      language: 'en',
    });
    setResults([]);
    setQ('');
  }

  async function add() {
    setMsg(null);
    try {
      await api('/collection', {
        method: 'POST',
        body: { scryfall_id: selected.scryfall_id, ...form, quantity: Number(form.quantity) },
      });
      setMsg(`✓ ${selected.name} ajoutée`);
      setSelected(null);
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
                <span className="text-xs text-slate-400 uppercase">{c.set}</span>
                <span className="text-xs text-emerald-400 w-14 text-right">
                  {c.prices?.eur ? `${c.prices.eur} €` : '—'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <div className="mt-2 flex flex-wrap items-end gap-2 bg-slate-800 border border-slate-700 rounded-md p-3">
          <div className="flex-1 min-w-[8rem] text-sm font-medium">{selected.name}</div>
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
              {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
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
          <button type="button" onClick={() => setSelected(null)} className="text-slate-400 text-sm px-2">
            Annuler
          </button>
        </div>
      )}

      {msg && <div className="mt-2 text-xs text-slate-400">{msg}</div>}
    </div>
  );
}
