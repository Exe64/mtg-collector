import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Check } from 'lucide-react';
import { api } from '../api/client';
import { artCrop } from '../constants';
import { useCardModal } from '../stores/cardModal';
import Decklist from '../components/commanders/Decklist';
import { Badges, Mana, StarButton, eur } from '../components/commanders/parts';

const h2 = 'text-sm font-semibold text-slate-300 mb-2';
const panel = 'bg-slate-800/50 border border-white/[0.06] rounded-xl p-4';

function CardGrid({ cards }) {
  const openCard = useCardModal((s) => s.open);
  return (
    <ul className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-10 gap-2">
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

export default function CommanderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [notice, setNotice] = useState(null);
  const [wish, setWish] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    window.scrollTo(0, 0);
    setD(null);
    setError(null);
    setWish(null);
    api(`/commanders/${id}`)
      .then((r) => { if (!cancelled) setD(r); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [id]);

  useEffect(() => {
    api('/commanders/shortlist').then((r) => setShortlist(r.shortlist)).catch(() => {});
  }, []);

  // Retour à la liste telle qu'on l'a quittée (filtres conservés) ; lien direct → liste.
  const back = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/commanders'));

  async function toggleStar() {
    setNotice(null);
    const on = shortlist.includes(id);
    try {
      if (on) await api(`/commanders/shortlist/${id}`, { method: 'DELETE' });
      else await api('/commanders/shortlist', { method: 'POST', body: { oracle_id: id } });
      setShortlist((s) => (on ? s.filter((x) => x !== id) : [...s, id]));
    } catch (e) {
      setNotice(e.message);
    }
  }

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

  const backButton = (
    <button type="button" onClick={back} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 mb-4">
      <ArrowLeft size={14} /> Commandants
    </button>
  );

  if (error) return <div>{backButton}<p className="text-center text-rose-400 py-12">{error}</p></div>;
  if (!d) {
    return (
      <div>
        {backButton}
        <p className="text-center text-slate-500 py-12">Chargement de la fiche… La première ouverture interroge EDHREC et Commander Spellbook, compte quelques secondes.</p>
      </div>
    );
  }

  const c = d.commander;
  const e = d.edhrec;

  return (
    <div>
      {backButton}

      <section className="relative overflow-hidden rounded-tile border border-white/[0.06] bg-slate-800 mb-4">
        {c.image_uri && (
          <img src={artCrop(c.image_uri)} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30 blur-md scale-110" />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-slate-900/40" />
        <div className="relative flex flex-col md:flex-row gap-5 p-4 sm:p-6">
          {c.image_uri && (
            <img src={c.image_uri} alt={c.name} className="w-56 md:w-64 mx-auto md:mx-0 rounded-[4.75%/3.5%] shadow-xl shadow-black/50 self-start" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start gap-2">
              <h1 className="page-title flex-1">{c.name}</h1>
              <StarButton on={shortlist.includes(id)} onToggle={toggleStar} name={c.name} className="shrink-0" />
            </div>
            {c.name_fr && c.name_fr !== c.name && <p className="text-sm text-slate-400">{c.name_fr}</p>}
            <p className="text-sm text-slate-300 mt-1 flex flex-wrap items-center gap-2">{c.type_line} <Mana cost={c.mana_cost} /></p>
            <Badges c={c} owned={c.owned} className="mt-2" />
            {c.oracle_text && <p className="mt-3 text-sm text-slate-200 whitespace-pre-line max-w-3xl">{c.oracle_text}</p>}
            <dl className="mt-4 grid grid-cols-3 gap-2 text-center max-w-lg">
              <div className="glass rounded-lg p-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Rang EDHREC</dt>
                <dd className="text-sm font-semibold">{c.rank ? `#${c.rank}` : '—'}</dd>
              </div>
              <div className="glass rounded-lg p-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Decks</dt>
                <dd className="text-sm font-semibold">{(e?.numDecks ?? c.num_decks)?.toLocaleString('fr-FR') ?? '—'}</dd>
              </div>
              <div className="glass rounded-lg p-2">
                <dt className="text-[10px] uppercase tracking-[0.12em] text-slate-400">Prix</dt>
                <dd className="text-sm font-semibold text-emerald-400">{eur(c.eur)}</dd>
              </div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              {e && (
                <a href={`https://edhrec.com/commanders/${e.slug || ''}`} target="_blank" rel="noreferrer" className="btn-outline flex items-center gap-1.5">
                  EDHREC <ExternalLink size={13} />
                </a>
              )}
            </div>
            {notice && <p role="status" className="mt-2 text-xs text-rose-400">{notice}</p>}
            {c.pairing === 'background' && <p className="mt-2 text-xs text-slate-400">Un Historique ne peut pas mener seul : il accompagne un commandant doté de « Choisir un Historique ».</p>}
            {d.unavailable?.length > 0 && (
              <p className="mt-2 text-sm text-gold-400">
                {d.unavailable.map((s) => (s === 'edhrec' ? 'EDHREC' : 'Commander Spellbook')).join(' et ')} indisponible pour le moment : données partielles.
              </p>
            )}
            {e?.themes?.length > 0 && (
              <div className="mt-4">
                <h2 className={h2}>Thèmes</h2>
                <div className="flex flex-wrap gap-1.5">
                  {e.themes.map((t) => (
                    <button key={t.slug} type="button" onClick={() => navigate(`/commanders?mode=themes&theme=${t.slug}`)} className="rounded-full bg-slate-700/80 hover:bg-slate-600 px-2.5 py-1 text-xs">
                      {t.name} <span className="text-slate-400">{t.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {d.deck && d.coverage ? (
            <Decklist
              commanderName={c.name} deck={d.deck} coverage={d.coverage}
              onBuild={buildWith} building={busy} buildMsg={wish}
            />
          ) : c.pairing !== 'background' && (
            <section className={panel}><p className="text-sm text-slate-400">Pas de deck moyen EDHREC pour ce commandant.</p></section>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {d.combos?.length > 0 && (
            <section className={panel}>
              <h2 className={h2}>Combos (Commander Spellbook)</h2>
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

          {e?.similar?.length > 0 && (
            <section className={panel}>
              <h2 className={h2}>Commandants similaires</h2>
              <ul className="grid grid-cols-2 gap-2">
                {e.similar.map((s) => (
                  <li key={s.oracle_id}>
                    <button type="button" onClick={() => navigate(`/commanders/${s.oracle_id}`)} className="group block w-full text-left">
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
      </div>

      {e?.topCards?.length > 0 && (
        <section className="mt-4">
          <h2 className={h2}>Cartes les plus jouées</h2>
          <CardGrid cards={e.topCards} />
        </section>
      )}
      {e?.synergyCards?.length > 0 && (
        <section className="mt-4">
          <h2 className={h2}>Haute synergie</h2>
          <CardGrid cards={e.synergyCards} />
        </section>
      )}
    </div>
  );
}
