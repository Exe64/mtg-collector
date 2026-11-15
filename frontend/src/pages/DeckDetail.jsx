import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Check, Copy, Image, Layers, Pencil, Search, Star, Trash2, TriangleAlert, X,
} from 'lucide-react';
import { api } from '../api/client';
import { artCrop } from '../constants';
import { useCardModal } from '../stores/cardModal';
import HoverCard from '../components/ui/HoverCard';
import Modal from '../components/ui/Modal';
import { ColorPips, CoverageBar, Mana, eur } from '../components/commanders/parts';
import {
  COMMANDER_FORMATS, FORMATS, ZONES, deckStats, formatLabel, groupByType, savedDeckText,
} from '../components/decks/logic';

const panel = 'bg-slate-800/50 border border-white/[0.06] rounded-xl p-4';
const field = 'w-full rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm';
const h2 = 'text-sm font-semibold text-slate-300 mb-2';
const modalClass = 'rounded-2xl w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-auto p-4';
const COLOR_LABEL = { W: 'Blanc', U: 'Bleu', B: 'Noir', R: 'Rouge', G: 'Vert', C: 'Incolore' };

function CloseButton({ onClose }) {
  return (
    <button type="button" onClick={onClose} aria-label="Fermer" className="w-11 h-11 sm:w-8 sm:h-8 -mt-2 -mr-2 shrink-0 flex items-center justify-center rounded-md text-slate-400 hover:text-slate-50">
      <X size={18} />
    </button>
  );
}

/** Nom, format et notes du deck ; suppression. */
function EditDeck({ deck, onClose, onSaved }) {
  const navigate = useNavigate();
  const [name, setName] = useState(deck.name);
  const [format, setFormat] = useState(deck.format);
  const [notes, setNotes] = useState(deck.notes || '');
  const [error, setError] = useState(null);

  async function save(e) {
    e.preventDefault();
    try {
      await api(`/decks/${deck.id}`, { method: 'PATCH', body: { name: name.trim(), format, notes } });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    if (!window.confirm(`Supprimer le deck « ${deck.name} » ? Ta collection n'est pas modifiée.`)) return;
    try {
      await api(`/decks/${deck.id}`, { method: 'DELETE' });
      navigate('/decks', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal onClose={onClose} label="Modifier le deck" className={modalClass}>
      <form onSubmit={save} className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold text-slate-50">Modifier le deck</h2>
          <CloseButton onClose={onClose} />
        </div>
        <label className="block text-xs text-slate-400">
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs text-slate-400">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={`${field} mt-1`}>
            {FORMATS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs text-slate-400">
          Notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} maxLength={5000} className={`${field} mt-1`} />
        </label>
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={remove} className="mr-auto flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
            <Trash2 size={14} /> Supprimer
          </button>
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-300 hover:text-slate-50">Annuler</button>
          <button type="submit" className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 px-4 py-2 text-sm">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

/** Ligne du deck : quantité, zone, impression ; retrait. */
function EditLine({
  deckId, line, isCover, onClose, onSaved,
}) {
  const [qty, setQty] = useState(line.qty);
  const [zone, setZone] = useState(line.zone);
  const [printing, setPrinting] = useState(line.scryfall_id);
  const [printings, setPrintings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(`/decks/${deckId}/cards/${line.id}/printings`).then((r) => setPrintings(r.printings)).catch(() => setPrintings([]));
  }, [deckId, line.id]);

  async function save(e) {
    e.preventDefault();
    try {
      const body = { quantity: Number(qty), zone };
      if (printing !== line.scryfall_id) body.scryfall_id = printing;
      await api(`/decks/${deckId}/cards/${line.id}`, { method: 'PATCH', body });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  // Image de fond du deck : cette impression, ou retour au choix par défaut.
  async function setCover() {
    try {
      await api(`/decks/${deckId}`, { method: 'PATCH', body: { cover_scryfall_id: isCover ? null : line.scryfall_id } });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove() {
    try {
      await api(`/decks/${deckId}/cards/${line.id}`, { method: 'DELETE' });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <Modal onClose={onClose} label={`Modifier ${line.name}`} className={modalClass}>
      <form onSubmit={save} className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-slate-50 min-w-0 truncate">{line.name}</h2>
          <CloseButton onClose={onClose} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs text-slate-400">
            Quantité
            <input type="number" min={1} max={250} value={qty} onChange={(e) => setQty(e.target.value)} required className={`${field} mt-1`} />
          </label>
          <label className="block text-xs text-slate-400">
            Zone
            <select value={zone} onChange={(e) => setZone(e.target.value)} className={`${field} mt-1`}>
              {ZONES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
            </select>
          </label>
        </div>
        {/* min-w-0 : un fieldset vaut min-content par défaut et empêcherait la troncature */}
        <fieldset className="min-w-0">
          <legend className="text-xs text-slate-400 mb-1">Impression</legend>
          {!printings ? <p className="text-sm text-slate-500">Chargement…</p> : (
            <ul className="max-h-64 overflow-auto rounded-lg border border-white/[0.06] divide-y divide-white/[0.06]">
              {printings.map((p) => (
                <li key={p.scryfall_id}>
                  <label className={`flex items-center gap-3 px-2 py-1.5 text-sm cursor-pointer ${printing === p.scryfall_id ? 'bg-gold-500/10' : 'hover:bg-white/5'}`}>
                    <input type="radio" name="printing" value={p.scryfall_id} checked={printing === p.scryfall_id} onChange={() => setPrinting(p.scryfall_id)} />
                    <span className="flex-1 min-w-0 truncate">
                      {p.set_name} <span className="uppercase text-slate-500 text-xs">{p.set_code} #{p.collector_number}</span>
                    </span>
                    {p.owned > 0 && <span className="text-xs text-emerald-400 shrink-0">{p.owned} possédée{p.owned > 1 ? 's' : ''}</span>}
                    <span className="w-16 text-right text-xs text-slate-300 shrink-0">{eur(p.eur)}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </fieldset>
        <button type="button" onClick={setCover} className="btn-outline flex items-center gap-1.5">
          <Image size={14} /> {isCover ? 'Revenir à l\'image par défaut' : 'Image du deck'}
        </button>
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button type="button" onClick={remove} className="mr-auto flex items-center gap-1.5 rounded-md px-3 py-2 text-sm text-rose-300 hover:bg-rose-500/10">
            <Trash2 size={14} /> Retirer du deck
          </button>
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-300 hover:text-slate-50">Annuler</button>
          <button type="submit" className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 px-4 py-2 text-sm">Enregistrer</button>
        </div>
      </form>
    </Modal>
  );
}

/** Recherche Scryfall → ajout dans la zone choisie (impression possédée, sinon la moins chère). */
function AddCard({ deckId, onAdded }) {
  const [q, setQ] = useState('');
  const [zone, setZone] = useState('main');
  const [results, setResults] = useState([]);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setResults([]); return undefined; }
    let cancelled = false;
    const t = setTimeout(() => {
      api(`/cards/search?q=${encodeURIComponent(term)}`)
        .then((r) => { if (!cancelled) setResults(r.cards.slice(0, 8)); })
        .catch(() => { if (!cancelled) setResults([]); });
    }, 300);
    return () => { cancelled = true; clearTimeout(t); };
  }, [q]);

  async function add(card) {
    setMsg(null);
    try {
      await api(`/decks/${deckId}/cards`, { method: 'POST', body: { name: card.name, scryfall_id: card.scryfall_id, zone } });
      setMsg(`${card.name} ajoutée (${ZONES.find(([v]) => v === zone)[1].toLowerCase()}).`);
      setQ('');
      setResults([]);
      onAdded();
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div className="relative">
      <div className="flex gap-2">
        <label className="relative flex-1">
          <span className="sr-only">Ajouter une carte</span>
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ajouter une carte…" className={`${field} pl-9`} />
        </label>
        <select aria-label="Zone d'ajout" value={zone} onChange={(e) => setZone(e.target.value)} className="rounded-lg bg-slate-800 border border-edge px-2 py-2 text-sm">
          {ZONES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </div>
      {results.length > 0 && (
        <ul className="absolute z-20 inset-x-0 mt-1 rounded-lg border border-white/10 bg-slate-800 shadow-2xl shadow-black/50 overflow-hidden">
          {results.map((c) => (
            <li key={c.scryfall_id}>
              <button type="button" onClick={() => add(c)} className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:bg-white/5">
                {c.image_small && <img src={c.image_small} alt="" className="w-7 rounded-sm" />}
                <span className="truncate">{c.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {msg && <p role="status" className="text-xs text-slate-300 mt-1.5">{msg}</p>}
    </div>
  );
}

function CardRow({ c, onEdit }) {
  const openCard = useCardModal((s) => s.open);
  const lacking = c.missing > 0;
  const others = c.used_in.length > 0 && c.owned > 0;
  return (
    <li className="flex items-center gap-1 rounded hover:bg-white/5">
      <HoverCard image={c.image_uri} className="flex-1 min-w-0">
      <button type="button" onClick={() => openCard(c.scryfall_id)} className="w-full min-w-0 flex items-center gap-2 px-1 py-0.5 text-left text-sm">
        <span className="w-4 shrink-0 flex justify-center">
          {c.owned > 0 && !lacking && <Check size={14} className="text-emerald-400" aria-label="Possédée" />}
        </span>
        <span className={`flex-1 min-w-0 truncate ${lacking ? 'text-slate-400' : 'text-slate-100'}`}>
          {c.qty > 1 && <span className="text-slate-500">{c.qty} </span>}{c.name}
          <span className="ml-1.5 text-[10px] uppercase text-slate-500">{c.set_code}{c.finish && c.finish !== 'nonfoil' && <span className="ml-1 text-gold-400">{c.finish === 'foil' ? 'foil' : 'etched'}</span>}</span>
        </span>
        {others && (
          <span title={`Aussi dans : ${c.used_in.map((d) => d.name).join(', ')}`} className="shrink-0 text-gold-400">
            <Layers size={13} aria-label={`Aussi dans ${c.used_in.length} autre(s) deck(s)`} />
          </span>
        )}
        <Mana cost={c.mana_cost} className="shrink-0 text-xs" />
        {/* Colonne de largeur fixe : le CCM reste aligné, qu'il y ait un prix ou non */}
        <span className="w-20 shrink-0 text-right">
          {c.basic ? (
            <span className="text-[10px] uppercase tracking-[0.12em] text-slate-500">base</span>
          ) : lacking ? (
            <span className="text-xs text-emerald-400" title={`Il en manque ${c.missing} (impression la moins chère)`}>
              {c.owned > 0 && <span className="text-slate-500">{c.missing}× </span>}{eur(c.cheapest_eur)}
            </span>
          ) : c.eur !== null && (
            <span className="text-xs text-slate-500" title="Prix de l'impression choisie (possédée)">{eur(c.eur)}</span>
          )}
        </span>
      </button>
      </HoverCard>
      <button type="button" onClick={() => onEdit(c)} aria-label={`Modifier ${c.name}`} className="w-9 h-9 sm:w-7 sm:h-7 shrink-0 flex items-center justify-center rounded text-slate-500 hover:text-slate-100">
        <Pencil size={13} />
      </button>
    </li>
  );
}

function Group({ label, cards, onEdit }) {
  return (
    <div className="break-inside-avoid mb-4">
      <h3 className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400 border-b border-white/[0.06] pb-1 mb-1">
        {label} <span className="text-slate-500">({cards.reduce((s, c) => s + c.qty, 0)})</span>
      </h3>
      <ul>{cards.map((c) => <CardRow key={c.id} c={c} onEdit={onEdit} />)}</ul>
    </div>
  );
}

function Stats({ cards }) {
  const { curve, colors, types } = useMemo(() => deckStats(cards), [cards]);
  const max = Math.max(1, ...curve);
  return (
    <section className={panel}>
      <h2 className={h2}>Courbe de mana <span className="font-normal text-slate-500">(hors terrains)</span></h2>
      <div className="flex items-end gap-1.5 h-24" role="img" aria-label={`Courbe de mana : ${curve.map((n, i) => `${n} à ${i === 7 ? '7+' : i}`).join(', ')}`}>
        {curve.map((n, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
            <span className="text-[10px] text-slate-400">{n || ''}</span>
            <div className="w-full rounded-t bg-gold-500/70" style={{ height: `${(70 * n) / max}%` }} />
            <span className="text-[10px] text-slate-500 mt-0.5">{i === 7 ? '7+' : i}</span>
          </div>
        ))}
      </div>
      <h2 className={`${h2} mt-4`}>Couleurs</h2>
      <ul className="flex flex-wrap gap-3 text-sm">
        {Object.entries(colors).filter(([, n]) => n).map(([k, n]) => (
          <li key={k} className="flex items-center gap-1"><ColorPips identity={[k]} /><span className="sr-only">{COLOR_LABEL[k]}</span> {n}</li>
        ))}
      </ul>
      <h2 className={`${h2} mt-4`}>Types</h2>
      <ul className="grid grid-cols-2 gap-x-4 text-sm">
        {types.map(([label, n]) => (
          <li key={label} className="flex justify-between"><span className="text-slate-400">{label}</span>{n}</li>
        ))}
      </ul>
    </section>
  );
}

export default function DeckDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [missingOnly, setMissingOnly] = useState(false);
  const [editing, setEditing] = useState(null); // ligne en cours d'édition
  const [editDeck, setEditDeck] = useState(false);
  const [copied, setCopied] = useState(false);
  const [msg, setMsg] = useState(null);
  const unknown = location.state?.unknown || [];

  const load = useCallback(() => {
    api(`/decks/${id}`).then(setD).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const zones = useMemo(() => {
    const shown = (d?.cards || []).filter((c) => !missingOnly || c.missing > 0);
    return ZONES.map(([zone, label]) => [zone, label, shown.filter((c) => c.zone === zone)]);
  }, [d, missingOnly]);

  const back = (
    <button type="button" onClick={() => navigate('/decks')} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 mb-4">
      <ArrowLeft size={14} /> Decks
    </button>
  );
  if (error) return <div>{back}<p className="text-center text-rose-400 py-12">{error}</p></div>;
  if (!d) return <div>{back}<p className="text-center text-slate-500 py-12">Chargement du deck…</p></div>;

  const { deck, cards, summary, issues } = d;
  const commanders = cards.filter((c) => c.zone === 'commander');
  const identity = [...new Set(commanders.flatMap((c) => c.color_identity))];
  const target = COMMANDER_FORMATS.has(deck.format) ? ' / 100' : '';

  async function copy() {
    try {
      await navigator.clipboard.writeText(savedDeckText(cards));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* presse-papiers refusé */ }
  }

  async function toWishlist() {
    setMsg(null);
    try {
      const r = await api(`/decks/${id}/missing-to-wishlist`, { method: 'POST' });
      setMsg(r.missing === 0 ? 'Tu possèdes déjà toutes les cartes du deck.'
        : `${r.added} carte(s) ajoutée(s) à la wishlist${r.added < r.missing ? ` (${r.missing - r.added} y étaient déjà)` : ''}.`);
    } catch (err) {
      setMsg(err.message);
    }
  }

  return (
    <div>
      {back}

      <section className="relative overflow-hidden rounded-tile border border-white/[0.06] bg-slate-800 mb-4">
        {deck.cover && (
          <>
            <img src={artCrop(deck.cover)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-50 blur-md scale-110" />
            {/* Whole art, sharp, on the right where there is no text; fades into the blurred backdrop */}
            <img
              src={artCrop(deck.cover)} alt=""
              className="hidden lg:block absolute inset-y-0 right-0 h-full w-auto max-w-[55%] object-cover"
              style={{ maskImage: 'linear-gradient(to right, transparent, black 35%)', WebkitMaskImage: 'linear-gradient(to right, transparent, black 35%)' }}
            />
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/85 via-slate-900/55 to-slate-900/10" />
        <div className="relative p-4 sm:p-6">
          <div className="flex items-start gap-2">
            <h1 className="page-title flex-1 min-w-0 break-words">{deck.name}</h1>
            <button type="button" onClick={() => setEditDeck(true)} className="glass shrink-0 flex items-center gap-1.5 rounded-md px-3 h-11 sm:h-9 text-sm text-slate-200 hover:text-gold-200">
              <Pencil size={14} /> Modifier
            </button>
          </div>
          <p className="text-sm text-slate-300 mt-1 flex flex-wrap items-center gap-2">
            <span>{formatLabel(deck.format)}</span>
            {commanders.length > 0 && <><span>· {commanders.map((c) => c.name).join(' + ')}</span><ColorPips identity={identity} /></>}
          </p>
          {deck.notes && <p className="mt-2 text-sm text-slate-300 whitespace-pre-line max-w-3xl">{deck.notes}</p>}

          <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center max-w-2xl">
            <div className="glass rounded-lg p-2">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Cartes</dt>
              <dd className="text-sm font-semibold">{summary.count}{target}</dd>
            </div>
            <div className="glass rounded-lg p-2">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Possédé</dt>
              <dd className="text-sm font-semibold">{summary.pct === null ? '—' : `${summary.pct} %`}</dd>
            </div>
            <div className="glass rounded-lg p-2">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Pour compléter</dt>
              <dd className="text-sm font-semibold text-emerald-400">{eur(summary.missingEur)}</dd>
            </div>
            <div className="glass rounded-lg p-2">
              <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Valeur</dt>
              <dd className="text-sm font-semibold">{eur(summary.valueEur)}</dd>
            </div>
          </dl>
          {summary.pct !== null && <div className="mt-3 max-w-2xl"><CoverageBar pct={summary.pct} /></div>}
          <p className="mt-2 text-xs text-slate-400 max-w-2xl">
            Possession comparée par nom, toutes éditions confondues ; {summary.missingDistinct
              ? `${summary.missingDistinct} carte(s) manquante(s), chiffrées à l'impression la moins chère.`
              : 'il ne manque rien.'} La valeur suit les impressions choisies. Le « peut-être » et la réserve ne comptent pas.
          </p>
        </div>
      </section>

      {unknown.length > 0 && (
        <p role="status" className="mb-4 rounded-lg border border-gold-500/30 bg-gold-500/5 p-3 text-sm text-gold-200">
          Non reconnues à l'import, donc non ajoutées : {unknown.join(', ')}.
        </p>
      )}

      {issues.length > 0 && (
        <section className={`${panel} mb-4`} aria-label="Contrôles de légalité">
          <h2 className={h2}>Légalité ({formatLabel(deck.format)})</h2>
          <ul className="space-y-1.5 text-sm">
            {issues.map((i) => (
              <li key={i.message} className="flex gap-2">
                <TriangleAlert size={15} className={`shrink-0 mt-0.5 ${i.level === 'error' ? 'text-rose-400' : 'text-gold-400'}`} aria-label={i.level === 'error' ? 'Erreur' : 'Avertissement'} />
                <span>
                  <span className={i.level === 'error' ? 'text-rose-300' : 'text-gold-200'}>{i.message}</span>
                  {i.cards.length > 0 && <span className="text-slate-400"> : {i.cards.join(', ')}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <section className={`${panel} lg:col-span-2 min-w-0`}>
          <AddCard deckId={id} onAdded={load} />
          <div className="flex flex-wrap items-center gap-2 mt-4 mb-3">
            <label className="flex items-center gap-2 text-sm text-slate-300 mr-auto">
              <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
              Manquantes seulement
            </label>
            <button type="button" onClick={copy} disabled={!cards.length} className="btn-outline flex items-center gap-1.5 disabled:opacity-50">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? 'Liste copiée' : 'Copier la liste'}
            </button>
            <button type="button" onClick={toWishlist} disabled={!summary.missingDistinct} className="flex items-center gap-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-4 py-2 text-sm">
              <Star size={14} /> Manquantes en wishlist
            </button>
          </div>
          {msg && <p role="status" className="text-xs text-slate-300 mb-3">{msg}</p>}

          {!cards.length ? (
            <p className="text-sm text-slate-500 py-6 text-center">Deck vide : cherche une carte pour l'ajouter.</p>
          ) : zones.every(([, , list]) => !list.length) ? (
            <p className="text-sm text-slate-500 py-6 text-center">Tu possèdes toutes les cartes du deck.</p>
          ) : zones.map(([zone, label, list]) => list.length > 0 && (
            <div key={zone} className="mb-2">
              {zone === 'main' ? (
                <>
                  {zones[0][2].length > 0 && <h2 className={`${h2} mt-2`}>{label}</h2>}
                  <div className="columns-1 md:columns-2 gap-6">
                    {groupByType(list).map(([g, gl]) => <Group key={g} label={g} cards={gl} onEdit={setEditing} />)}
                  </div>
                </>
              ) : (
                <div className="md:w-1/2"><Group label={label} cards={list} onEdit={setEditing} /></div>
              )}
            </div>
          ))}
        </section>

        <div className="space-y-4 min-w-0">
          {cards.length > 0 && <Stats cards={cards} />}
          <p className="text-xs text-slate-500">
            <Layers size={12} className="inline text-gold-400 mr-1" aria-hidden="true" />
            Carte possédée déjà utilisée dans un autre deck. Un deck ne réserve aucun exemplaire.{' '}
            <Link to="/deck" className="underline hover:text-slate-300">Vérifier une autre liste</Link>
          </p>
        </div>
      </div>

      {editing && <EditLine deckId={id} line={editing} isCover={deck.cover_scryfall_id === editing.scryfall_id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
      {editDeck && <EditDeck deck={deck} onClose={() => setEditDeck(false)} onSaved={() => { setEditDeck(false); load(); }} />}
    </div>
  );
}
