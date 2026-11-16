import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, ListChecks } from 'lucide-react';
import { api } from '../api/client';
import { artCrop, identityTint } from '../constants';
import Modal from '../components/ui/Modal';
import { ColorPips, CoverageBar } from '../components/commanders/parts';
import { FORMATS, formatLabel, groupByFormat } from '../components/decks/logic';

const field = 'w-full rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm';
const SOURCES = [['empty', 'Vide'], ['text', 'Liste'], ['url', 'Moxfield']];

/** Création : deck vide, liste collée ou .txt, URL Moxfield publique. */
function NewDeck({ onClose }) {
  const navigate = useNavigate();
  const [source, setSource] = useState('text');
  const [name, setName] = useState('');
  const [format, setFormat] = useState('');
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setText(String(reader.result));
      if (!name) setName(f.name.replace(/\.txt$/i, ''));
    };
    reader.readAsText(f);
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const body = { name: name.trim() || undefined, format: format || undefined };
      if (source === 'text') body.text = text;
      if (source === 'url') body.url = url.trim();
      const r = await api('/decks', { method: 'POST', body });
      navigate(`/decks/${r.id}`, { state: { unknown: r.unknown } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const ready = source === 'empty' || (source === 'text' ? text.trim() : url.trim());
  return (
    <Modal onClose={onClose} label="Nouveau deck" className="rounded-2xl w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-auto p-0">
      <form onSubmit={submit} className="p-4 space-y-3">
        <h2 className="font-display text-2xl font-semibold text-slate-50">Nouveau deck</h2>
        <div className="seg" role="group" aria-label="Source du deck">
          {SOURCES.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={source === v} onClick={() => setSource(v)} className={`seg-btn ${source === v ? 'seg-btn-on' : ''}`}>{label}</button>
          ))}
        </div>
        <label className="block text-xs text-slate-400">
          Nom
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={200} placeholder={source === 'url' ? 'Celui du deck Moxfield' : 'Nouveau deck'} className={`${field} mt-1`} />
        </label>
        <label className="block text-xs text-slate-400">
          Format
          <select value={format} onChange={(e) => setFormat(e.target.value)} className={`${field} mt-1`}>
            <option value="">{source === 'url' ? 'Celui du deck Moxfield (Commander par défaut)' : 'Commander'}</option>
            {FORMATS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>
        </label>
        {source === 'text' && (
          <>
            <textarea
              value={text} onChange={(e) => setText(e.target.value)} rows={8} aria-label="Liste du deck"
              placeholder={'Commander\n1 Krenko, Mob Boss\n\nDeck\n1 Sol Ring\n…'}
              className={`${field} font-mono`}
            />
            <label className="block text-xs text-slate-400">
              Ou importer un .txt
              <input type="file" accept=".txt,text/plain" onChange={onFile} className="block mt-1 text-xs" />
            </label>
            <p className="text-xs text-slate-500">Les sections Commander, Sideboard et Maybeboard sont reconnues. Chaque carte prend ton exemplaire s'il existe, sinon l'impression la moins chère.</p>
          </>
        )}
        {source === 'url' && (
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.moxfield.com/decks/…" aria-label="URL du deck Moxfield" className={field} />
        )}
        {error && <p role="alert" className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className="rounded-md px-4 py-2 text-sm text-slate-300 hover:text-slate-50">Annuler</button>
          <button type="submit" disabled={!ready || busy} className="rounded-md bg-indigo-600 hover:bg-indigo-500 text-slate-900 disabled:opacity-50 px-4 py-2 text-sm">
            {busy ? 'Création…' : 'Créer le deck'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeckTile({ d }) {
  return (
    <li className="group rounded-tile overflow-hidden border border-white/[0.06] bg-slate-800 hover:border-gold-500/40">
      <Link to={`/decks/${d.id}`} className="block">
        <div className="relative aspect-[16/9] bg-slate-700" style={identityTint(d.color_identity)}>
          {d.cover && <img loading="lazy" src={artCrop(d.cover)} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-800 via-slate-800/10 to-transparent" />
          <span className="glass absolute top-2 right-2 rounded-md px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-slate-300">{formatLabel(d.format)}</span>
        </div>
        <div className="relative -mt-6 px-3 pb-3">
          <span className="block truncate font-display text-lg font-semibold leading-snug text-slate-50 group-hover:text-gold-200">{d.name}</span>
          <span className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
            <span className="truncate">{d.commanders.join(' + ') || `${d.count} carte${d.count > 1 ? 's' : ''}`}</span>
            {d.commanders.length > 0 && <ColorPips identity={d.color_identity} />}
          </span>
          <span className="flex items-center justify-between text-xs text-slate-300 mt-2 mb-1">
            <span>{d.pct === null ? 'Deck vide' : `${d.pct} % possédé`}</span>
            {d.commanders.length > 0 && <span className="text-slate-400">{d.count} cartes</span>}
          </span>
          <CoverageBar pct={d.pct ?? 0} />
        </div>
      </Link>
    </li>
  );
}

export default function Decks() {
  const [decks, setDecks] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [params, setParams] = useSearchParams();

  const groups = groupByFormat(decks || []);
  // Format inconnu dans l'URL (deck supprimé, lien obsolète) → tous les formats.
  const format = groups.some(([f]) => f === params.get('format')) ? params.get('format') : '';
  const shown = format ? groups.filter(([f]) => f === format) : groups;
  const pickFormat = (f) => setParams(f ? { format: f } : {}, { replace: true });

  useEffect(() => {
    api('/decks').then((r) => setDecks(r.decks)).catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-1">
        <h1 className="page-title mr-auto">Decks</h1>
        <Link to="/deck" className="flex items-center gap-1.5 text-sm text-slate-300 hover:text-gold-200">
          <ListChecks size={15} /> Vérifier une liste sans l'enregistrer
        </Link>
        <button type="button" onClick={() => setCreating(true)} className="btn-outline flex items-center gap-1.5">
          <Plus size={15} /> Nouveau deck
        </button>
      </div>
      <p className="text-sm text-slate-400 mb-5">
        Un deck est une liste : il ne réserve aucun exemplaire et ne modifie jamais ta collection.
      </p>

      {error && <p className="text-sm text-rose-400">{error}</p>}
      {decks && !decks.length && (
        <div className="text-center py-16 text-slate-400">
          <p className="mb-3">Aucun deck pour l'instant.</p>
          <p className="text-sm">Colle une liste, importe un deck Moxfield, ou pars d'un commandant avec « Construire avec ».</p>
        </div>
      )}
      {groups.length > 1 && (
        <select value={format} onChange={(e) => pickFormat(e.target.value)} aria-label="Format" className="mb-4 rounded-lg bg-slate-800 border border-edge px-3 py-2 text-sm">
          <option value="">Tous les formats ({decks.length})</option>
          {groups.map(([f, list]) => <option key={f} value={f}>{formatLabel(f)} ({list.length})</option>)}
        </select>
      )}
      {shown.map(([f, list]) => (
        <section key={f} className="mb-6" aria-label={formatLabel(f)}>
          {shown.length > 1 && (
            <h2 className="font-display text-xl font-semibold text-slate-200 mb-2">
              {formatLabel(f)} <span className="text-sm font-normal text-slate-400">({list.length})</span>
            </h2>
          )}
          <ul className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {list.map((d) => <DeckTile key={d.id} d={d} />)}
          </ul>
        </section>
      ))}
      {creating && <NewDeck onClose={() => setCreating(false)} />}
    </div>
  );
}
