import { useState, useEffect } from 'react';
import { api } from '../../api/client';
import { useCardModal } from '../../stores/cardModal';
import LineChart from '../charts/LineChart';
import { manaSymbols } from '../../constants';

function Mana({ cost }) {
  const syms = manaSymbols(cost);
  if (!syms.length) return null;
  return <span>{syms.map((s, i) => <i key={i} className={`ms ms-${s} ms-cost`} aria-hidden="true" />)}</span>;
}

export default function CardModal() {
  const scryfallId = useCardModal((s) => s.scryfallId);
  const close = useCardModal((s) => s.close);
  const [card, setCard] = useState(null);
  const [rulings, setRulings] = useState([]);
  const [history, setHistory] = useState([]);
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
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scryfallId]);

  useEffect(() => {
    if (!scryfallId) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scryfallId, close]);

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
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
      onClick={close}
    >
      <div
        className="bg-slate-800 rounded-xl max-w-3xl w-full max-h-[90vh] overflow-auto p-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end">
          <button type="button" onClick={close} aria-label="Fermer" className="text-slate-400 hover:text-white text-xl leading-none">✕</button>
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
                  <img src={src} alt={card.name} className="w-full rounded-lg" />
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
                <h2 className="font-display text-lg font-bold">{card.name}</h2>
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
                <span className="text-emerald-400">{card.prices?.eur ? `${card.prices.eur} €` : '—'}</span>
                {card.prices?.eur_foil && <span className="text-emerald-300">{card.prices.eur_foil} € foil</span>}
                {card.prices?.usd && <span className="text-slate-400">${card.prices.usd}</span>}
              </div>

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
                  <select value={alertDir} onChange={(e) => setAlertDir(e.target.value)}
                    className="rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm">
                    <option value="below">Prévenir si le prix descend sous</option>
                    <option value="above">Prévenir si le prix monte au-dessus de</option>
                  </select>
                  <input
                    type="number" step="0.01" min="0" value={alertThreshold}
                    onChange={(e) => setAlertThreshold(e.target.value)}
                    placeholder="€" className="w-24 rounded bg-slate-800 border border-slate-700 px-2 py-1 text-sm"
                  />
                  <button type="button" onClick={createAlert}
                    className="text-sm rounded bg-indigo-600 hover:bg-indigo-500 px-3 py-1">Créer</button>
                </div>
              )}

              {history.filter((h) => h.eur != null).length >= 2 && (
                <div className="mt-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-1">Évolution du prix (EUR)</h3>
                  <LineChart points={history.map((h) => ({ date: h.snapshot_date, value: h.eur }))} />
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
      </div>
    </div>
  );
}
