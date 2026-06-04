import { useCardModal } from '../../stores/cardModal';
import { CONDITION_LABEL } from '../../constants';

const RARITY_COLORS = {
  common: 'text-slate-300',
  uncommon: 'text-slate-200',
  rare: 'text-amber-300',
  mythic: 'text-orange-400',
};

export default function CollectionTable({ entries, onUpdateQty, onDelete }) {
  const openCard = useCardModal((s) => s.open);

  if (!entries.length) {
    return <div className="text-center text-slate-500 py-12">Aucune carte. Cherche une carte ci-dessus pour commencer.</div>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800">
      <table className="w-full text-sm">
        <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
          <tr>
            <th className="text-left p-2">Carte</th>
            <th className="text-left p-2 hidden sm:table-cell">Ext.</th>
            <th className="text-left p-2 hidden md:table-cell">Rareté</th>
            <th className="text-right p-2">Qté</th>
            <th className="text-left p-2 hidden sm:table-cell">Fin.</th>
            <th className="text-left p-2 hidden md:table-cell">État</th>
            <th className="text-right p-2">PU €</th>
            <th className="text-right p-2">Total €</th>
            <th className="p-2" />
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id} className="border-t border-slate-800 hover:bg-slate-800/50">
              <td className="p-2">
                <button
                  type="button"
                  onClick={() => openCard(e.card.scryfall_id)}
                  className="flex items-center gap-2 text-left hover:text-indigo-300"
                >
                  {e.card.image_small && <img src={e.card.image_small} alt="" className="w-8 rounded-sm" />}
                  <span>{e.card.name}</span>
                </button>
              </td>
              <td className="p-2 hidden sm:table-cell uppercase text-slate-400">{e.card.set}</td>
              <td className={`p-2 hidden md:table-cell capitalize ${RARITY_COLORS[e.card.rarity] || ''}`}>{e.card.rarity}</td>
              <td className="p-2 text-right">
                <input
                  type="number" min="1" defaultValue={e.quantity}
                  onBlur={(ev) => {
                    const v = Number(ev.target.value);
                    if (v >= 1 && v !== e.quantity) onUpdateQty(e.id, v);
                  }}
                  className="w-14 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-right"
                />
              </td>
              <td className="p-2 hidden sm:table-cell text-slate-400">{e.finish}</td>
              <td className="p-2 hidden md:table-cell text-slate-400">{CONDITION_LABEL[e.condition] || e.condition}</td>
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
