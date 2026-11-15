import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { X, Layers } from 'lucide-react';
import { api } from '../../api/client';
import { useCardModal } from '../../stores/cardModal';
import LineChart from '../charts/LineChart';
import CardPrice from './CardPrice';
import Modal from './Modal';
import { manaSymbols, artCrop } from '../../constants';

function Mana({ cost }) {
  const syms = manaSymbols(cost);
  if (!syms.length) return null;
  return <span>{syms.map((s, i) => <i key={i} className={`ms ms-${s} ms-cost`} aria-hidden="true" />)}</span>;
}

export default function CardModal() {
  const scryfallId = useCardModal((s) => s.scryfallId);
  const close = useCardModal((s) => s.close);
  const open = useCardModal((s) => s.open);
  const [card, setCard] = useState(null);
  const [rulings, setRulings] = useState([]);
  const [history, setHistory] = useState([]);
  const [printings, setPrintings] = useState([]);
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showBack, setShowBack] = useState(false);
  const [wishMsg, setWishMsg] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertDir, setAlertDir] = useState('below');
  const [alertThreshold, setAlertThreshold] = useState('');
  const [alertMsg, setAlertMsg] = useState(null);

  useEffect(() => {
    if (!scryfallId) return undefined;
    let cancelled = false;
    setLoading(true);
    setCard(null);
    setRulings([]);
    setHistory([]);
    setDecks([]);
    setPrintings([]);
    setShowBack(false);
    setWishMsg(null);
    setShowAlert(false);
    setAlertMsg(null);
    setAlertThreshold('');
    setAlertDir('below');
    (async () => {
      try {
        const [detail, rul, hist] = await Promise.all([
          api(`/cards/${scryfallId}`),
          api(`/cards/${scryfallId}/rulings`).catch(() => ({ rulings: [] })),
          api(`/cards/${scryfallId}/price-history`).catch(() => ({ history: [] })),
        ]);
        if (cancelled) return;
        setCard(detail.card);
        setRulings(rul.rulings || []);
        setHistory(hist.history || []);
        // Après le détail : /cards/:id insère la carte en base, requise pour trouver ses sœurs.
        const [pr, dk] = await Promise.all([
          api(`/collection/printings/${scryfallId}`).catch(() => ({ printings: [] })),
          api(`/decks/by-card/${scryfallId}`).catch(() => ({ decks: [] })),
        ]);
        if (!cancelled) { setPrintings(pr.printings || []); setDecks(dk.decks || []); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scryfallId]);

  // Série tracée : le non-foil, ou le foil pour les impressions qui n'ont pas de cote
  // non-foil (promos prerelease…) — sinon la courbe restait vide sur ces cartes.
  const priceSeries = useMemo(() => {
    const pick = (key) => history.filter((h) => h[key] != null)
      .map((h) => ({ date: h.snapshot_date, value: Number(h[key]) }));
    const eur = pick('eur');
    if (eur.length >= 2) return { points: eur, foil: false };
    const foil = pick('eur_foil');
    return foil.length >= 2 ? { points: foil, foil: true } : null;
  }, [history]);

  async function addToWishlist() {
    setWishMsg(null);
    try {
      await api('/wishlist', { method: 'POST', body: { scryfall_id: scryfallId } });
      setWishMsg('✓ ajoutée à la wishlist');
    } catch (err) {
      setWishMsg(err.message);
    }
  }

  async function createAlert() {
    setAlertMsg(null);
    const threshold = parseFloat(String(alertThreshold).replace(',', '.'));
    if (!Number.isFinite(threshold) || threshold <= 0) {
      setAlertMsg('Seuil invalide');
      return;
    }
    try {
      await api('/alerts', {
        method: 'POST',
        body: { scryfall_id: scryfallId, direction: alertDir, threshold_eur: threshold },
      });
      setAlertMsg(`✓ alerte créée (${alertDir === 'below' ? 'sous' : 'au-dessus de'} ${threshold} €)`);
      setShowAlert(false);
    } catch (err) {
      setAlertMsg(err.message);
    }
  }

  if (!scryfallId) return null;

  const faces = card?.card_faces;

  return (
    <Modal
      onClose={close}
      label={card?.name || 'Détail de la carte'}
      className="isolate rounded-2xl w-[calc(100%-2rem)] max-w-3xl max-h-[90vh] overflow-auto p-4 sm:p-5"
    >
        {/* Illustration floutée en tête de modale */}
        {card?.image && (
          <div aria-hidden className="absolute inset-x-0 top-0 h-80 -z-10 overflow-hidden">
            <div className="absolute inset-0 bg-cover bg-center scale-125 blur-2xl opacity-40" style={{ backgroundImage: `url(${artCrop(card.image)})` }} />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-800" />
          </div>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={close} aria-label="Fermer" className="w-11 h-11 -mt-2 -mr-2 shrink-0 flex items-center justify-center rounded-md text-slate-400 hover:text-white"><X size={20} /></button>
        </div>

        {loading || !card ? (
          <div className="text-center text-slate-500 py-12">Chargement…</div>
        ) : (
          <div className="flex flex-col md:flex-row gap-4">
            {(() => {
              const back = faces?.[1]?.image_uris?.normal || faces?.[1]?.image_uris?.large;
              const src = showBack && back ? back : card.image;
              if (!src) return null;
              return (
                <div className="md:w-64 shrink-0 self-start">
                  <img loading="lazy" src={src} alt={card.name} className="w-full rounded-[4.75%/3.5%] shadow-xl shadow-black/50" />
                  {back && (
                    <button type="button" onClick={() => setShowBack((v) => !v)}
                      className="mt-1 w-full rounded bg-slate-700 hover:bg-slate-600 text-xs py-1">
                      ↻ Retourner la carte
                    </button>
                  )}
                </div>
              );
            })()}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline justify-between gap-2">
                <h2 className="font-display text-2xl font-semibold leading-tight text-slate-50">{card.name}</h2>
                <span className="text-sm text-slate-400"><Mana cost={card.mana_cost} /></span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {card.type_line} · <span className="uppercase">{card.set} #{card.collector_number}</span> · <span className="capitalize">{card.rarity}</span>
              </div>

              {card.oracle_text && (
                <p className="text-sm text-slate-200 whitespace-pre-line mt-3">{card.oracle_text}</p>
              )}
              {faces?.length > 1 && (
                <div className="mt-3 space-y-2">
                  {faces.map((f, i) => (
                    <div key={i} className="border-t border-slate-700 pt-2">
                      <div className="text-sm font-semibold">{f.name} <span className="text-xs text-slate-400"><Mana cost={f.mana_cost} /></span></div>
                      <div className="text-xs text-slate-400">{f.type_line}</div>
                      {f.oracle_text && <p className="text-sm text-slate-200 whitespace-pre-line mt-1">{f.oracle_text}</p>}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-4 text-sm mt-3">
                <CardPrice card={card} />
                {card.prices?.usd && <span className="text-slate-400">${card.prices.usd}</span>}
              </div>

              {(() => {
                const here = printings.find((p) => p.scryfall_id === scryfallId);
                const others = printings.filter((p) => p.scryfall_id !== scryfallId);
                const total = printings.reduce((n, p) => n + p.nonfoil + p.foil, 0);
                return (
                  <div className="mt-3 text-sm">
                    {/* Possession de la carte, toutes éditions confondues, puis détail de cette édition */}
                    <div className="text-slate-200">
                      {total > 0
                        ? <>Dans ta collection : <span className="font-semibold text-emerald-400">{total}</span> exemplaire(s), toutes éditions</>
                        : <span className="text-slate-400">Pas dans ta collection</span>}
                    </div>
                    <div className="text-slate-400 text-xs mt-0.5">
                      Cette édition : <span className="font-semibold text-slate-300">{here?.nonfoil || 0}</span> normale(s)
                      {' · '}<span className="font-semibold text-gold-400">{here?.foil || 0}</span> foil
                    </div>
                    {others.length > 0 && (
                      <ul className="mt-1 text-xs text-slate-400 space-y-0.5">
                        {others.map((p) => (
                          <li key={p.scryfall_id}>
                            <button type="button" onClick={() => open(p.scryfall_id)} className="hover:text-indigo-300 text-left">
                              {p.set_name} <span className="uppercase text-slate-500">{p.set_code} #{p.collector_number}</span>
                            </button>
                            {' — '}{p.nonfoil} normale(s){p.foil > 0 && <>, <span className="text-gold-400">{p.foil} foil</span></>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {decks.length > 0 && (
                      <div className="mt-2 text-xs text-slate-300 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <Layers size={13} className="text-gold-400" aria-hidden="true" />
                        Utilisée dans :
                        {decks.map((dk) => (
                          <Link key={dk.id} to={`/decks/${dk.id}`} onClick={close} className="text-gold-300 hover:text-gold-200 underline">{dk.name}</Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={addToWishlist}
                  className="text-sm rounded bg-slate-700 hover:bg-slate-600 px-3 py-1">★ Wishlist</button>
                <button type="button" onClick={() => setShowAlert((v) => !v)}
                  className="text-sm rounded bg-slate-700 hover:bg-slate-600 px-3 py-1">🔔 Alerte prix</button>
                {wishMsg && <span className="text-xs text-slate-400">{wishMsg}</span>}
                {alertMsg && <span className="text-xs text-slate-400">{alertMsg}</span>}
              </div>

              {showAlert && (
                <div className="mt-2 flex flex-wrap items-center gap-2 bg-slate-900 rounded p-2">
                  <select value={alertDir} onChange={(e) => setAlertDir(e.target.value)} aria-label="Sens de l'alerte"
                    className="rounded bg-slate-800 border border-edge px-2 py-1 text-sm">
                    <option value="below">Prévenir si le prix descend sous</option>
                    <option value="above">Prévenir si le prix monte au-dessus de</option>
                  </select>
                  <input
                    type="number" step="0.01" min="0" value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    placeholder="€" aria-label="Seuil en euros" className="w-24 rounded bg-slate-800 border border-edge px-2 py-1 text-sm"
                  />
                  <button type="button" onClick={createAlert}
                    className="text-sm rounded bg-indigo-600 hover:bg-indigo-500 text-slate-900 px-3 py-1">Créer</button>
                </div>
              )}

              {priceSeries && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-1">
                    Évolution du prix (EUR{priceSeries.foil ? ', foil' : ''})
                  </h3>
                  <LineChart points={priceSeries.points} />
                </div>
              )}

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-1">
                  Rulings {rulings.length > 0 && <span className="text-slate-500">({rulings.length})</span>}
                </h3>
                {rulings.length === 0 ? (
                  <p className="text-xs text-slate-500">Aucun ruling pour cette carte.</p>
                ) : (
                  <ul className="space-y-2">
                    {rulings.map((r, i) => (
                      <li key={i} className="text-xs text-slate-300">
                        <span className="text-slate-500">{r.published_at} — </span>{r.comment}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
    </Modal>
  );
}
