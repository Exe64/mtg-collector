import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api/client';
import { useCardModal } from '../stores/cardModal';
import LineChart from '../components/charts/LineChart';
import { identityStyle } from '../constants';

const FILTERS = [
  { key: 'all', label: 'Toutes' },
  { key: 'owned', label: 'Possédées' },
  { key: 'missing', label: 'Manquantes' },
];

const SORT_OPTIONS = [
  ['number', 'N° de collecteur'],
  ['price-desc', 'Prix décroissant'],
  ['price-asc', 'Prix croissant'],
  ['name-fr-asc', 'Nom FR A→Z'],
  ['name-fr-desc', 'Nom FR Z→A'],
  ['name-asc', 'Nom EN A→Z'],
  ['name-desc', 'Nom EN Z→A'],
  ['type', 'Type'],
];
const TYPE_OPTIONS = [
  ['', 'Type'], ['creature', 'Créature'], ['instant', 'Éphémère'], ['sorcery', 'Rituel'],
  ['artifact', 'Artefact'], ['enchantment', 'Enchantement'], ['planeswalker', 'Planeswalker'],
  ['land', 'Terrain'], ['battle', 'Bataille'],
];
const RARITY_OPTIONS = [
  ['', 'Rareté'], ['common', 'Commune'], ['uncommon', 'Peu commune'], ['rare', 'Rare'], ['mythic', 'Mythique'],
];
const COLOR_OPTIONS = [
  ['', 'Couleur'], ['W', 'Blanc'], ['U', 'Bleu'], ['B', 'Noir'], ['R', 'Rouge'], ['G', 'Vert'],
  ['M', 'Multicolore'], ['C', 'Incolore'],
];
const CMC_OPTIONS = [['', 'Coût'], ['0', '0'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['6', '6'], ['7+', '7+']];
const EMPTY_ATTR = { type: '', rarity: '', color: '', cmc: '' };

// ponytail: filtres/tri client — toutes les cartes du set sont déjà chargées en mémoire.
function matchAttr(c, f) {
  if (f.type && !(c.type_line || '').toLowerCase().includes(f.type)) return false;
  if (f.rarity && c.rarity !== f.rarity) return false;
  if (f.cmc) {
    if (f.cmc === '7+') { if (!(Number(c.cmc) >= 7)) return false; }
    else if (Number(c.cmc) !== Number(f.cmc)) return false;
  }
  if (f.color) {
    const ci = c.color_identity || [];
    if (f.color === 'C') return ci.length === 0;
    if (f.color === 'M') return ci.length > 1;
    return ci.length === 1 && ci[0] === f.color; // mono-couleur stricte (exclut les multicolores)
  }
  return true;
}

function sortCards(arr, sort) {
  if (sort === 'number') return arr; // ordre du backend (gère les variantes type "250★")
  const price = (c) => Number(c.prices?.eur) || 0;
  // Nom FR si dispo, sinon retombe sur l'anglais (toutes les cartes n'ont pas de nom FR).
  const fr = (c) => c.name_fr || c.name;
  const by = {
    'price-desc': (a, b) => price(b) - price(a),
    'price-asc': (a, b) => price(a) - price(b),
    'name-fr-asc': (a, b) => fr(a).localeCompare(fr(b), 'fr'),
    'name-fr-desc': (a, b) => fr(b).localeCompare(fr(a), 'fr'),
    'name-asc': (a, b) => a.name.localeCompare(b.name),
    'name-desc': (a, b) => b.name.localeCompare(a.name),
    type: (a, b) => (a.type_line || '').localeCompare(b.type_line || '') || a.name.localeCompare(b.name),
  };
  return by[sort] ? [...arr].sort(by[sort]) : arr;
}

function FinishRow({ label, count, accent, onMinus, onPlus }) {
  const plusCls = accent === 'gold' ? 'bg-gold-600 hover:bg-gold-500' : 'bg-indigo-600 hover:bg-indigo-500';
  return (
    <div className="flex items-center justify-between gap-1">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-1">
        <span className={`text-xs w-4 text-center ${count > 0 ? 'text-slate-100' : 'text-slate-600'}`}>{count}</span>
        <button
          type="button" onClick={onMinus} disabled={count === 0} aria-label={`Retirer ${label}`}
          className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-30 text-sm leading-none"
        >−</button>
        <button
          type="button" onClick={onPlus} aria-label={`Ajouter ${label}`}
          className={`w-6 h-6 rounded ${plusCls} text-sm leading-none`}
        >+</button>
      </div>
    </div>
  );
}

export default function SetDetail() {
  const { code } = useParams();
  const openCard = useCardModal((s) => s.open);
  const [cards, setCards] = useState([]);
  const [setName, setSetName] = useState('');
  const [cardCount, setCardCount] = useState(null);
  const [printedSize, setPrintedSize] = useState(null);
  const [owned, setOwned] = useState({});
  const [setValue, setSetValue] = useState(0);
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('number');
  const [attr, setAttr] = useState(EMPTY_ATTR);
  const [showMissing, setShowMissing] = useState(false);
  const [setSnaps, setSetSnaps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api(`/collection/set-snapshots?set=${encodeURIComponent(code)}&days=90`)
      .then((d) => { if (!cancelled) setSetSnaps(d.snapshots || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [code]);

  const loadOwned = useCallback(async () => {
    const data = await api(`/collection/owned?set=${encodeURIComponent(code)}`);
    setOwned(data.owned || {});
    setSetValue(data.totalEur || 0);
  }, [code]);

  const totalQty = useCallback((id) => {
    const o = owned[id];
    return o ? (o.nonfoil || 0) + (o.foil || 0) : 0;
  }, [owned]);

  // Métadonnées du set (un seul appel, pas toute la liste)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { set: s } = await api(`/sets/${encodeURIComponent(code)}`);
        if (!cancelled && s) {
          setCardCount(s.card_count ?? null);
          setPrintedSize(s.printed_size ?? null);
          if (s.name) setSetName(s.name);
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [code]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setCards([]);
      setFilter('all');
      await loadOwned();
      let page = 1;
      let more = true;
      let all = [];
      let name = '';
      while (more && !cancelled) {
        // eslint-disable-next-line no-await-in-loop
        const data = await api(`/sets/${encodeURIComponent(code)}/cards?page=${page}`);
        all = all.concat(data.cards || []);
        if (data.cards?.[0]?.set_name) name = data.cards[0].set_name;
        more = Boolean(data.hasMore);
        page += 1;
      }
      if (!cancelled) {
        setCards(all);
        setSetName(name);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [code, loadOwned]);

  async function adjust(card, finish, delta) {
    const id = card.scryfall_id;
    const unit = Number(card.prices?.eur) || 0;
    setOwned((o) => {
      const cur = o[id] || { nonfoil: 0, foil: 0 };
      return { ...o, [id]: { ...cur, [finish]: Math.max((cur[finish] || 0) + delta, 0) } };
    });
    setSetValue((v) => Math.max(0, +(v + unit * delta).toFixed(2)));
    try {
      await api('/collection/adjust', {
        method: 'POST',
        body: { scryfall_id: id, delta, finish },
      });
    } catch {
      loadOwned();
    }
  }

  // Base set strict : cartes au numéro de collecteur ≤ printed_size (hors variants/promos)
  const baseCards = useMemo(() => {
    const limit = printedSize || cardCount || Infinity;
    return cards
      .filter((c) => {
        const n = Number(c.collector_number);
        return Number.isInteger(n) && n >= 1 && n <= limit;
      })
      .sort((a, b) => Number(a.collector_number) - Number(b.collector_number));
  }, [cards, printedSize, cardCount]);

  const ownedCount = baseCards.filter((c) => totalQty(c.scryfall_id) > 0).length;
  const total = baseCards.length || (printedSize ?? cardCount ?? cards.length);
  const pct = total ? Math.min(100, Math.round((100 * ownedCount) / total)) : 0;
  const missingBase = baseCards.filter((c) => totalQty(c.scryfall_id) === 0);
  const missingCost = useMemo(
    () => missingBase.reduce((s, c) => s + (Number(c.prices?.eur) || 0), 0),
    [missingBase],
  );

  // Cartes possédées dont l'impression ne figure pas dans la liste du set (ex. sync
  // bulk incomplet / impression différente) → on le signale plutôt qu'un silence.
  const orphanOwned = useMemo(() => {
    if (loading || cards.length === 0) return { count: 0, qty: 0 };
    const ids = new Set(cards.map((c) => c.scryfall_id));
    let count = 0;
    let qty = 0;
    for (const [id, o] of Object.entries(owned)) {
      const q = (o.nonfoil || 0) + (o.foil || 0);
      if (q > 0 && !ids.has(id)) { count += 1; qty += q; }
    }
    return { count, qty };
  }, [owned, cards, loading]);

  // Filtres d'attributs (type/rareté/couleur/coût) appliqués avant les compteurs owned/missing
  const attrCards = useMemo(() => cards.filter((c) => matchAttr(c, attr)), [cards, attr]);

  const visible = useMemo(() => {
    const filtered = attrCards.filter((c) => {
      const has = totalQty(c.scryfall_id) > 0;
      if (filter === 'owned') return has;
      if (filter === 'missing') return !has;
      return true;
    });
    return sortCards(filtered, sort);
  }, [attrCards, totalQty, filter, sort]);

  // Compteurs des filtres : basés sur les cartes réellement affichées (impressions)
  const ownedDisplayed = attrCards.filter((c) => totalQty(c.scryfall_id) > 0).length;
  const counts = { all: attrCards.length, owned: ownedDisplayed, missing: attrCards.length - ownedDisplayed };
  const hasAttr = Object.values(attr).some(Boolean);

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Link to="/sets" className="text-slate-400 hover:text-slate-200 text-sm">← Extensions</Link>
        <i className={`ss ss-${code} ss-2x text-gold-400`} aria-hidden="true" />
        <h1 className="font-display text-xl font-bold">
          {setName || code.toUpperCase()} <span className="text-slate-500 text-sm uppercase">({code})</span>
        </h1>
        <span className="ml-auto text-sm whitespace-nowrap">
          <span className="text-slate-400">Valeur : </span>
          <span className="text-emerald-400 font-semibold">{setValue.toFixed(2)} €</span>
        </span>
      </div>

      {orphanOwned.count > 0 && (
        <div className="mb-3 text-xs rounded-md border border-gold-700/50 bg-gold-950/30 text-gold-200 px-3 py-2">
          ⚠️ {orphanOwned.count} carte(s) possédée(s) ({orphanOwned.qty} exemplaire(s)) ne figurent pas dans la liste de
          cette extension — impression non listée ou base de cartes incomplète. Elles sont bien dans ta collection et
          comptées dans la valeur, mais pas affichées ci-dessous. Un <code>sync:bulk</code> complet peut les réaligner.
        </div>
      )}

      {/* Complétion (base set strict) */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>Complétion (set de base)</span>
          <span>{ownedCount} / {total} cartes · <span className="text-emerald-400">{pct}%</span></span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        {missingBase.length > 0 && (
          <div className="mt-1">
            <button type="button" onClick={() => setShowMissing((v) => !v)} className="text-xs text-slate-400 hover:text-slate-200">
              {showMissing ? '▾' : '▸'} {missingBase.length} numéro{missingBase.length > 1 ? 's' : ''} manquant{missingBase.length > 1 ? 's' : ''}
              {missingCost > 0 && <span className="text-emerald-400"> · ~{missingCost.toFixed(2)} € pour compléter</span>}
            </button>
            {showMissing && (
              <div className="mt-1 flex flex-wrap gap-1 max-h-40 overflow-auto">
                {missingBase.map((c) => (
                  <button
                    key={c.scryfall_id}
                    type="button"
                    onClick={() => openCard(c.scryfall_id)}
                    title={c.name}
                    className="text-[11px] bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded px-1.5 py-0.5"
                  >
                    #{c.collector_number}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {setSnaps.filter((s) => s.total_value_eur != null).length >= 2 && (
        <div className="mb-4">
          <h2 className="text-xs text-slate-400 mb-1">Valeur de mes cartes de cette extension (90 j)</h2>
          <LineChart points={setSnaps.map((s) => ({ date: s.snapshot_date, value: s.total_value_eur }))} />
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-1 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`text-xs rounded px-3 py-1.5 ${filter === f.key ? 'bg-slate-600' : 'bg-slate-800 hover:bg-slate-700'}`}
          >
            {f.label} <span className="text-slate-400">({counts[f.key]})</span>
          </button>
        ))}
      </div>

      {/* Tri + filtres d'attributs */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={sort} onChange={(e) => setSort(e.target.value)}
          className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm">
          {SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        {[['type', TYPE_OPTIONS], ['rarity', RARITY_OPTIONS], ['color', COLOR_OPTIONS], ['cmc', CMC_OPTIONS]].map(([key, opts]) => (
          <select key={key} value={attr[key]} onChange={(e) => setAttr((a) => ({ ...a, [key]: e.target.value }))}
            className="rounded-md bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm">
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
        {hasAttr && (
          <button type="button" onClick={() => setAttr(EMPTY_ATTR)}
            className="text-xs text-slate-400 hover:text-slate-200 px-2">Réinitialiser</button>
        )}
      </div>

      {loading ? (
        <div className="text-center text-slate-500 py-12">Chargement de l'extension…</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3">
          {visible.map((c) => {
            const o = owned[c.scryfall_id] || { nonfoil: 0, foil: 0 };
            const qty = (o.nonfoil || 0) + (o.foil || 0);
            const canFoil = !Array.isArray(c.finishes) || c.finishes.some((f) => f !== 'nonfoil');
            return (
              <div
                key={c.scryfall_id}
                style={identityStyle(c.color_identity)}
                className={`relative rounded-lg overflow-hidden border ${qty > 0 ? 'border-emerald-500' : 'border-slate-700'} bg-slate-800`}
              >
                {qty > 0 && (
                  <span className="absolute top-1 right-1 z-10 bg-emerald-500 text-slate-900 text-xs font-bold rounded-full px-2 py-0.5">
                    ×{qty}
                  </span>
                )}
                {c.image ? (
                  <button type="button" onClick={() => openCard(c.scryfall_id)} className="block w-full">
                    <img src={c.image} alt={c.name} className={`w-full ${qty > 0 ? '' : 'opacity-60'}`} loading="lazy" />
                  </button>
                ) : (
                  <button type="button" onClick={() => openCard(c.scryfall_id)} className="aspect-[5/7] w-full flex items-center justify-center text-xs text-slate-500 p-2 text-center">{c.name}</button>
                )}
                <div className="p-2">
                  <div className="text-xs truncate" title={c.name_fr ? `${c.name_fr} · ${c.name}` : c.name}>#{c.collector_number} {c.name_fr || c.name}</div>
                  <div className="text-xs text-emerald-400 mt-0.5">{c.prices?.eur ? `${c.prices.eur} €` : '—'}</div>
                  <div className="mt-1.5 space-y-1">
                    <FinishRow label="Normale" count={o.nonfoil || 0} accent="indigo"
                      onMinus={() => adjust(c, 'nonfoil', -1)} onPlus={() => adjust(c, 'nonfoil', 1)} />
                    {canFoil && (
                      <FinishRow label="Foil" count={o.foil || 0} accent="gold"
                        onMinus={() => adjust(c, 'foil', -1)} onPlus={() => adjust(c, 'foil', 1)} />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {!visible.length && <div className="col-span-full text-center text-slate-500 py-8">Aucune carte dans ce filtre.</div>}
        </div>
      )}
    </div>
  );
}
