import { useCardModal } from '../../stores/cardModal';
import { CONDITIONS } from '../../constants';

const FINISHES = ['nonfoil', 'foil', 'etched'];

const RARITY_COLORS = {
  common: 'text-slate-300',
  uncommon: 'text-slate-200',
  rare: 'text-amber-300',
  mythic: 'text-orange-400',
};

export default function CollectionTable({ entries, onUpdate, onDelete }) {
  const openCard = useCardModal((s) => s.open);

  if (!entries.length) {
    return <div className="text-center text-slate-500 py-12">Aucune carte.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm table-fixed">
        <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
          <tr>
            <th className="text-left p-2">Carte</th>
            <th className="text-left p-2 w-16 hidden sm:table-cell">Ext.</th>
            <th className="text-left p-2 w-28 hidden md:table-cell">Rareté</th>
            <th className="text-right p-2 w-20">Qté</th>
            <th className="text-left p-2 w-28">Fin.</th>
            <th className="text-left p-2 w-36">État</th>
            <th className="text-right p-2 w-24">PU €</th>
            <th className="text-right p-2 w-24">Total €</th>
            <th className="p-2 w-10" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-slate-800 hover:bg-slate-800/50">
              <td className="p-2">
                <button
                  type="button"
                  onClick={() => openCard(e.card.scryfall_id)}
                  className="flex items-center gap-2 text-left hover:text-indigo-300 w-full min-w-0"
                >
                  {e.card.image_small && <img src={e.card.image_small} alt="" className="w-8 rounded-sm shrink-0" />}
                  <span className="truncate">{e.card.name}</span>
                </button>
              </td>
              <td className="p-2 hidden sm:table-cell uppercase text-slate-400">{e.card.set}</td>
              <td className={`p-2 hidden md:table-cell capitalize ${RARITY_COLORS[e.card.rarity] || ''}`}>{e.card.rarity}</td>
              <td className="p-2 text-right">
                <input
                  type="number" min="1" defaultValue={e.quantity}
                  key={`${e.id}-qty-${e.quantity}`}
                  onBlur={(ev) => {
                    const v = Number(ev.target.value);
                    if (v >= 1 && v !== e.quantity) onUpdate(e.id, { quantity: v });
                  }}
                  className="w-14 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-right"
                />
              </td>
              <td className="p-2">
                <select
                  value={e.finish}
                  onChange={(ev) => onUpdate(e.id, { finish: ev.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs"
                >
                  {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </td>
              <td className="p-2">
                <select
                  value={e.condition}
                  onChange={(ev) => onUpdate(e.id, { condition: ev.target.value })}
                  className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs"
                >
                  {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </td>
              <td className="p-2 text-right text-slate-300">{e.unit_price_eur ?? '—'}</td>
              <td className="p-2 text-right text-emerald-400">{e.total_price_eur ?? '—'}</td>
              <td className="p-2 text-right">
                <button type="button" onClick={() => onDelete(e.id)} className="text-rose-400 hover:text-rose-300">✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
