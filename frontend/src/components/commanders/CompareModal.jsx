import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../api/client';
import { artCrop } from '../../constants';
import Modal from '../ui/Modal';
import { PAIRINGS } from './logic';
import { ColorPips, Mana, eur } from './parts';

export default function CompareModal({ picks, owned, onOpen, onClose }) {
  const [details, setDetails] = useState({});

  useEffect(() => {
    for (const c of picks) {
      api(`/commanders/${c.oracle_id}`)
        .then((d) => setDetails((cur) => ({ ...cur, [c.oracle_id]: d })))
        .catch(() => setDetails((cur) => ({ ...cur, [c.oracle_id]: { failed: true } })));
    }
  }, [picks]);

  const cell = (c, render) => {
    const d = details[c.oracle_id];
    if (!d) return <span className="text-slate-500">…</span>;
    return d.failed ? <span className="text-slate-500">—</span> : render(d);
  };

  const rows = [
    ['Identité', (c) => <ColorPips identity={c.color_identity} />],
    ['Coût', (c) => <Mana cost={c.mana_cost} />],
    ['Prix', (c) => <span className="text-emerald-400 font-semibold">{eur(c.eur)}</span>],
    ['Rang EDHREC', (c) => (c.rank ? `#${c.rank}` : '—')],
    ['Decks EDHREC', (c) => c.num_decks?.toLocaleString('fr-FR') ?? '—'],
    ['Appariement', (c) => PAIRINGS[c.pairing] || '—'],
    ['Game Changer', (c) => (c.game_changer ? 'Oui' : 'Non')],
    ['Possédé', (c) => (owned.has(c.oracle_id) ? <span className="text-emerald-400">Oui</span> : 'Non')],
    ['Deck moyen possédé', (c) => cell(c, (d) => (d.coverage ? `${d.coverage.pct} % (${d.coverage.owned}/${d.coverage.total})` : '—'))],
    ['Pour compléter', (c) => cell(c, (d) => (d.coverage ? <span className="text-emerald-400">{eur(d.coverage.missingEur)}</span> : '—'))],
    ['Combos', (c) => cell(c, (d) => `${d.combos.length}${d.combos.some((x) => x.complete) ? ` (${d.combos.filter((x) => x.complete).length} complet)` : ''}`)],
    ['Thèmes', (c) => cell(c, (d) => d.edhrec?.themes.slice(0, 3).map((t) => t.name).join(', ') || '—')],
  ];

  return (
    <Modal onClose={onClose} label="Comparer les commandants" className="w-full max-w-5xl rounded-tile p-0">
      <div className="flex items-center justify-between p-4 border-b border-white/[0.06]">
        <h2 className="font-display text-2xl font-semibold text-slate-50">Comparer</h2>
        <button type="button" onClick={onClose} aria-label="Fermer" className="w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-50"><X size={16} /></button>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full text-sm table-fixed min-w-[36rem]">
          <thead>
            <tr>
              <th className="w-36" />
              {picks.map((c) => (
                <th key={c.oracle_id} className="p-2 align-top text-left font-normal">
                  <button type="button" onClick={() => onOpen(c.oracle_id)} className="group block w-full text-left">
                    <span className="block aspect-[16/9] rounded-md overflow-hidden bg-slate-700">
                      {c.image_uri && <img src={artCrop(c.image_uri)} alt="" className="w-full h-full object-cover" />}
                    </span>
                    <span className="block font-display text-base font-semibold leading-tight mt-1 text-slate-50 group-hover:text-gold-200">{c.name}</span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, render]) => (
              <tr key={label} className="border-t border-white/[0.06]">
                <th scope="row" className="p-2 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</th>
                {picks.map((c) => <td key={c.oracle_id} className="p-2 text-slate-200">{render(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}
