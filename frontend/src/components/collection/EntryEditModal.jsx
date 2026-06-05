import { useState } from 'react';
import { CONDITIONS, LANGUAGES } from '../../constants';

const FINISHES = ['nonfoil', 'foil', 'etched'];

export default function EntryEditModal({ entry, onSave, onClose }) {
  const [form, setForm] = useState({
    quantity: entry.quantity,
    finish: entry.finish,
    condition: entry.condition,
    language: entry.language,
    acquired_price: entry.acquired_price ?? '',
    acquired_at: entry.acquired_at ? String(entry.acquired_at).slice(0, 10) : '',
    notes: entry.notes ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await onSave({
        quantity: Number(form.quantity),
        finish: form.finish,
        condition: form.condition,
        language: form.language,
        acquired_price: form.acquired_price === '' ? null : Number(form.acquired_price),
        acquired_at: form.acquired_at || null,
        notes: form.notes || null,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const field = 'w-full rounded bg-slate-900 border border-slate-700 px-2 py-1.5 text-sm';

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-xl max-w-md w-full p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold truncate">{entry.card.name}</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
        </div>
        {error && <div className="text-xs text-rose-400">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs text-slate-400">Quantité
            <input type="number" min="1" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} className={field} />
          </label>
          <label className="text-xs text-slate-400">Finition
            <select value={form.finish} onChange={(e) => set('finish', e.target.value)} className={field}>
              {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">État
            <select value={form.condition} onChange={(e) => set('condition', e.target.value)} className={field}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Langue
            <select value={form.language} onChange={(e) => set('language', e.target.value)} className={field}>
              {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </label>
          <label className="text-xs text-slate-400">Prix d'achat (€)
            <input type="number" step="0.01" min="0" value={form.acquired_price} onChange={(e) => set('acquired_price', e.target.value)} className={field} />
          </label>
          <label className="text-xs text-slate-400">Date d'achat
            <input type="date" value={form.acquired_at} onChange={(e) => set('acquired_at', e.target.value)} className={field} />
          </label>
        </div>
        <label className="text-xs text-slate-400 block">Notes
          <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={2} className={field} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="text-slate-400 text-sm px-3 py-1.5">Annuler</button>
          <button type="button" onClick={save} disabled={busy}
            className="rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 px-4 py-1.5 text-sm">
            {busy ? '…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
}
