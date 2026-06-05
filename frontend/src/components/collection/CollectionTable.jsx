import { useCardModal } from '../../stores/cardModal';
import { CONDITIONS, identityStyle } from '../../constants';

const FINISHES = ['nonfoil', 'foil', 'etched'];

const RARITY_COLORS = {
  common: 'text-slate-300',
  uncommon: 'text-slate-200',
  rare: 'text-amber-300',
  mythic: 'text-orange-400',
};

function FinishSelect({ value, onChange }) {
  return (
    <select value={value} onChange={onChange} aria-label="Finition"
      className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs">
      {FINISHES.map((f) => <option key={f} value={f}>{f}</option>)}
    </select>
  );
}

function ConditionSelect({ value, onChange }) {
  return (
    <select value={value} onChange={onChange} aria-label="État"
      className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-xs">
      {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
    </select>
  );
}

function Th({ col, label, align = 'left', extra = '', sort, order, onSort }) {
  const active = sort === col;
  return (
    <th className={`p-2 text-${align} ${extra}`}>
      <button type="button" onClick={() => onSort(col)} className="uppercase hover:text-white">
        {label}{active ? (order === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
}

export default function CollectionTable({ entries, onUpdate, onDelete, onEdit, sort, order, onSort, selected, onToggleSelect, onSetMany }) {
  const openCard = useCardModal((s) => s.open);

  if (!entries.length) {
    return <div className="text-center text-slate-500 py-12">Aucune carte.</div>;
  }

  const allSelected = selected && entries.every((e) => selected.has(e.id));

  return (
    <>
      {/* Mobile : cartes empilées */}
      <ul className="sm:hidden space-y-2">
        {entries.map((e) => (
          <li key={e.id} style={identityStyle(e.card.color_identity)} className="bg-slate-800 border border-slate-700 rounded-lg p-2 pl-3">
            <div className="flex items-center gap-2">
              {selected && <input type="checkbox" checked={selected.has(e.id)} onChange={() => onToggleSelect(e.id)} aria-label="Sélectionner" />}
              <button type="button" onClick={() => openCard(e.card.scryfall_id)} className="flex items-center gap-2 min-w-0 flex-1 text-left">
                {e.card.image_small && <img src={e.card.image_small} alt="" className="w-9 rounded-sm shrink-0" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm">{e.card.name}</span>
                  <span className={`text-xs uppercase ${RARITY_COLORS[e.card.rarity] || 'text-slate-400'}`}>
                    {e.card.set} · {e.card.rarity}
                  </span>
                  {e.location && <span className="block text-[10px] text-slate-500 truncate">📍 {e.location}</span>}
                </span>
              </button>
              <span className="text-emerald-400 text-sm whitespace-nowrap">{e.total_price_eur ?? '—'} €</span>
              <button type="button" onClick={() => onEdit(e)} aria-label="Éditer" className="text-slate-300 px-1">✎</button>
              <button type="button" onClick={() => onDelete(e.id)} aria-label="Supprimer" className="text-rose-400 px-1">✕</button>
            </div>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <label className="text-[10px] text-slate-400">Qté
                <input type="number" min="1" defaultValue={e.quantity} key={`${e.id}-${e.quantity}`}
                  onBlur={(ev) => { const v = Number(ev.target.value); if (v >= 1 && v !== e.quantity) onUpdate(e.id, { quantity: v }); }}
                  className="block w-14 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-right" />
              </label>
              <FinishSelect value={e.finish} onChange={(ev) => onUpdate(e.id, { finish: ev.target.value })} />
              <ConditionSelect value={e.condition} onChange={(ev) => onUpdate(e.id, { condition: ev.target.value })} />
              <span className="text-xs text-slate-500 ml-auto">PU {e.unit_price_eur ?? '—'} €</span>
            </div>
          </li>
        ))}
      </ul>

      {/* Desktop : tableau */}
      <div className="hidden sm:block overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm table-fixed">
          <thead className="bg-slate-800 text-slate-400 text-xs uppercase">
            <tr>
              {selected && (
                <th className="p-2 w-8">
                  <input type="checkbox" checked={allSelected}
                    onChange={() => onSetMany(entries.map((e) => e.id), !allSelected)} aria-label="Tout sélectionner" />
                </th>
              )}
              <Th col="name" label="Carte" sort={sort} order={order} onSort={onSort} />
              <Th col="set" label="Ext." extra="w-16 hidden sm:table-cell" sort={sort} order={order} onSort={onSort} />
              <Th col="rarity" label="Rareté" extra="w-28 hidden md:table-cell" sort={sort} order={order} onSort={onSort} />
              <Th col="quantity" label="Qté" align="right" extra="w-20" sort={sort} order={order} onSort={onSort} />
              <th className="text-left p-2 w-28">Fin.</th>
              <th className="text-left p-2 w-36">État</th>
              <th className="text-right p-2 w-24">PU €</th>
              <Th col="value" label="Total €" align="right" extra="w-24" sort={sort} order={order} onSort={onSort} />
              <th className="p-2 w-16" />
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={identityStyle(e.card.color_identity)} className="border-t border-slate-800 hover:bg-slate-800/50">
                {selected && (
                  <td className="p-2">
                    <input type="checkbox" checked={selected.has(e.id)} onChange={() => onToggleSelect(e.id)} aria-label="Sélectionner" />
                  </td>
                )}
                <td className="p-2">
                  <button type="button" onClick={() => openCard(e.card.scryfall_id)}
                    className="flex items-center gap-2 text-left hover:text-indigo-300 w-full min-w-0">
                    {e.card.image_small && <img src={e.card.image_small} alt="" className="w-8 rounded-sm shrink-0" />}
                    <span className="min-w-0">
                      <span className="block truncate">{e.card.name}</span>
                      {e.location && <span className="block text-[10px] text-slate-500 truncate">📍 {e.location}</span>}
                    </span>
                  </button>
                </td>
                <td className="p-2 hidden sm:table-cell uppercase text-slate-400">{e.card.set}</td>
                <td className={`p-2 hidden md:table-cell capitalize ${RARITY_COLORS[e.card.rarity] || ''}`}>{e.card.rarity}</td>
                <td className="p-2 text-right">
                  <input type="number" min="1" defaultValue={e.quantity} key={`${e.id}-qty-${e.quantity}`}
                    onBlur={(ev) => { const v = Number(ev.target.value); if (v >= 1 && v !== e.quantity) onUpdate(e.id, { quantity: v }); }}
                    aria-label="Quantité"
                    className="w-14 rounded bg-slate-900 border border-slate-700 px-1 py-0.5 text-right" />
                </td>
                <td className="p-2"><FinishSelect value={e.finish} onChange={(ev) => onUpdate(e.id, { finish: ev.target.value })} /></td>
                <td className="p-2"><ConditionSelect value={e.condition} onChange={(ev) => onUpdate(e.id, { condition: ev.target.value })} /></td>
                <td className="p-2 text-right text-slate-300">{e.unit_price_eur ?? '—'}</td>
                <td className="p-2 text-right text-emerald-400">{e.total_price_eur ?? '—'}</td>
                <td className="p-2 text-right whitespace-nowrap">
                  <button type="button" onClick={() => onEdit(e)} aria-label="Éditer" className="text-slate-300 hover:text-white mr-1">✎</button>
                  <button type="button" onClick={() => onDelete(e.id)} aria-label="Supprimer" className="text-rose-400 hover:text-rose-300">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
