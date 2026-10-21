import { useEffect, useState } from 'react';
import { X, ExternalLink, Hammer, Check } from 'lucide-react';
import { api } from '../../api/client';
import { artCrop } from '../../constants';
import { useCardModal } from '../../stores/cardModal';
import Modal from '../ui/Modal';
import { Badges, Mana, StarButton, eur } from './parts';

const h2 = 'text-sm font-semibold text-slate-300 mb-2';
const section = 'bg-slate-900/40 border border-white/[0.06] rounded-xl p-4';

/** Barre de couverture : part du deck moyen déjà possédée (bleu jauge). */
export function CoverageBar({ pct }) {
  return (
    <div className="h-2 rounded-full bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
    </div>
  );
}

function CardGrid({ cards }) {
  const openCard = useCardModal((s) => s.open);
  return (
    <ul className="grid grid-cols-3 sm:grid-cols-5 gap-2">
      {cards.map((c) => (
        <li key={c.name}>
          <button
            type="button" disabled={!c.scryfall_id} onClick={() => openCard(c.scryfall_id)} title={c.name}
            className={`relative block w-full text-left ${c.owned ? '' : 'opacity-60 saturate-50 hover:opacity-100 hover:saturate-100'}`}
          >
            {c.image
              ? <img loading="lazy" src={c.image} alt={c.name} className="w-full rounded-[4.75%/3.5%]" />
              : <span className="block aspect-[63/88] rounded-md bg-slate-700 p-1 text-[10px]">{c.name}</span>}
            {c.owned && (
              <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center shadow-md shadow-black/40" aria-label="Possédée"><Check size={12} /></span>
            )}
          </button>
          {c.numDecks !== null && <span className="block text-[10px] text-slate-500 mt-0.5 truncate">{c.numDecks} decks</span>}
        </li>
      ))}
    </ul>
  );
}

export default function CommanderPanel({ id, byId, owned, starred, onStar, onOpen, onClose, onTheme }) {
  const base = byId.get(id);
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [wish, setWish] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api(`/commanders/${id}`)
      .then((r) => { if (!cancelled) setD(r); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  async function buildWith() {
    setBusy(true);
    setWish(null);
    try {
      const r = await api(`/commanders/${id}/missing-to-wishlist`, { method: 'POST' });
      setWish(r.missing === 0
        ? 'Tu possèdes déjà tout le deck moyen.'
        : `${r.added} carte(s) ajoutée(s) à la wishlist${r.added < r.missing ? ` (${r.missing - r.added} y étaient déjà)` : ''}.`);
    } catch (e) {
      setWish(e.message);
    } finally {
      setBusy(false);
    }
  }

  const c = d?.commander || base;
  const cov = d?.coverage;

  return (
    <Modal
      onClose={onClose}
      label={c ? `Fiche de ${c.name}` : 'Fiche commandant'}
      className="m-0 ml-auto h-full max-h-full w-full max-w-3xl sm:rounded-l-tile overflow-y-auto overscroll-contain p-0"
    >
      {!c ? (
        <div className="p-6 text-slate-400">{error || 'Commandant introuvable.'}</div>
      ) : (
        <>
          <div className="relative">
            {c.image_uri && (
              <img src={artCrop(c.image_uri)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-40 blur-sm scale-110" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-slate-800/40 to-slate-800" />
            <div className="relative flex flex-col sm:flex-row gap-4 p-4 sm:p-5">
              {c.image_uri && (
                <img src={c.image_uri} alt={c.name} className="w-48 sm:w-56 mx-auto sm:mx-0 rounded-[4.75%/3.5%] shadow-xl shadow-black/50 self-start" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <h2 className="font-display text-2xl font-semibold leading-tight text-slate-50 flex-1">{c.name}</h2>
                  <StarButton on={starred.has(c.oracle_id)} onToggle={() => onStar(c.oracle_id)} name={c.name} className="shrink-0" />
                  <button type="button" onClick={onClose} aria-label="Fermer" className="glass shrink-0 w-11 h-11 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-slate-300 hover:text-slate-50"><X size={16} /></button>
                </div>
                {c.name_fr && c.name_fr !== c.name && <p className="text-sm text-slate-400">{c.name_fr}</p>}
                <p className="text-sm text-slate-300 mt-1 flex items-center gap-2">{c.type_line} <Mana cost={c.mana_cost} /></p>
                <Badges c={c} owned={owned.has(c.oracle_id)} className="mt-2" />
                {c.oracle_text && <p className="mt-3 text-sm text-slate-200 whitespace-pre-line">{c.oracle_text}</p>}
                <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div className="glass rounded-lg p-2">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Rang EDHREC</dt>
                    <dd className="text-sm font-semibold">{c.rank ? `#${c.rank}` : '—'}</dd>
                  </div>
                  <div className="glass rounded-lg p-2">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Decks</dt>
                    <dd className="text-sm font-semibold">{(d?.edhrec?.numDecks ?? c.num_decks)?.toLocaleString('fr-FR') ?? '—'}</dd>
                  </div>
                  <div className="glass rounded-lg p-2">
                    <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Prix</dt>
                    <dd className="text-sm font-semibold text-emerald-400">{eur(c.eur)}</dd>
                  </div>
                </dl>
                <div className="mt-3 flex flex-wrap gap-2">
                  {c.pairing !== 'background' && (
                    <button type="button" onClick={buildWith} disabled={busy || !cov} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-4 py-2 text-sm">
                      <Hammer size={14} /> {busy ? 'Ajout…' : 'Construire avec'}
                    </button>
                  )}
                  {d?.edhrec && (
                    <a href={`https://edhrec.com/commanders/${d.edhrec.slug || ''}`} target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-1.5">
                      EDHREC <ExternalLink size={13} />
                    </a>
                  )}
                </div>
                {wish && <p role="status" className="mt-2 text-xs text-slate-300">{wish}</p>}
                {c.pairing === 'background' && <p className="mt-2 text-xs text-slate-400">Un Historique ne peut pas mener seul : il accompagne un commandant doté de « Choisir un Historique ».</p>}
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {error && <p className="text-sm text-rose-400">{error}</p>}
            {!d && !error && (
              <p className="text-sm text-slate-500">Chargement de la fiche… La première ouverture interroge EDHREC et Commander Spellbook, compte quelques secondes.</p>
            )}
            {d?.unavailable?.length > 0 && (
              <p className="text-sm text-gold-400">
                {d.unavailable.map((s) => (s === 'edhrec' ? 'EDHREC' : 'Commander Spellbook')).join(' et ')} indisponible pour le moment : données partielles.
              </p>
            )}

            {d?.edhrec?.themes?.length > 0 && (
              <section>
                <h3 className={h2}>Thèmes</h3>
                <div className="flex flex-wrap gap-1.5">
                  {d.edhrec.themes.map((t) => (
                    <button key={t.slug} type="button" onClick={() => onTheme(t.slug)} className="rounded-full bg-slate-700 hover:bg-slate-600 px-2.5 py-1 text-xs">
                      {t.name} <span className="text-slate-400">{t.count}</span>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {cov && (
              <section className={section}>
                <h3 className={h2}>Deck moyen EDHREC</h3>
                <div className="flex items-baseline justify-between gap-2 mb-1.5 text-sm">
                  <span><span className="text-xl font-semibold text-slate-50">{cov.pct} %</span> déjà possédé</span>
                  <span className="text-slate-400">{cov.owned} / {cov.total} cartes (hors terrains de base)</span>
                </div>
                <CoverageBar pct={cov.pct} />
                {cov.missing.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-slate-300">
                      {cov.missing.length} carte(s) manquante(s), environ <span className="text-emerald-400 font-semibold">{eur(cov.missingEur)}</span>
                    </summary>
                    <ul className="mt-2 columns-1 sm:columns-2 gap-4 text-sm">
                      {cov.missing.map((m) => (
                        <li key={m.name} className="flex justify-between gap-2 break-inside-avoid py-0.5">
                          <span className="truncate">{m.qty > 1 ? `${m.qty}× ` : ''}{m.name}</span>
                          <span className="text-emerald-400 shrink-0">{eur(m.eur)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </section>
            )}

            {d?.combos?.length > 0 && (
              <section className={section}>
                <h3 className={h2}>Combos (Commander Spellbook)</h3>
                <ul className="space-y-2">
                  {d.combos.map((cb) => (
                    <li key={cb.id} className="text-sm">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {cb.uses.map((u) => (
                          <span key={u.name} className={`rounded px-1.5 py-0.5 text-xs ${u.owned ? 'bg-emerald-500/15 text-emerald-300' : 'bg-slate-700 text-slate-300'}`}>{u.name}</span>
                        ))}
                        {cb.complete && <span className="text-[10px] uppercase tracking-[0.12em] text-emerald-400">Toutes les pièces possédées</span>}
                      </div>
                      <a href={`https://commanderspellbook.com/combo/${cb.id}/`} target="_blank" rel="noreferrer" className="text-xs text-slate-400 hover:text-gold-200">
                        {cb.produces.join(' · ')}
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {d?.edhrec?.topCards?.length > 0 && (
              <section>
                <h3 className={h2}>Cartes les plus jouées</h3>
                <CardGrid cards={d.edhrec.topCards} />
              </section>
            )}
            {d?.edhrec?.synergyCards?.length > 0 && (
              <section>
                <h3 className={h2}>Haute synergie</h3>
                <CardGrid cards={d.edhrec.synergyCards} />
              </section>
            )}

            {d?.edhrec?.similar?.length > 0 && (
              <section>
                <h3 className={h2}>Commandants similaires</h3>
                <ul className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {d.edhrec.similar.map((s) => (
                    <li key={s.oracle_id}>
                      <button type="button" onClick={() => onOpen(s.oracle_id)} className="group block w-full text-left">
                        <span className="block aspect-[16/9] rounded-md overflow-hidden bg-slate-700">
                          {s.image_uri && <img loading="lazy" src={artCrop(s.image_uri)} alt="" className="w-full h-full object-cover" />}
                        </span>
                        <span className="block truncate text-xs mt-1 group-hover:text-gold-200">
                          {s.owned && <Check size={11} className="inline text-emerald-400 mr-0.5" aria-label="Possédé" />}{s.name}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
