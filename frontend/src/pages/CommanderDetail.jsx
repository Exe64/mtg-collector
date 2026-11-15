import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft, ExternalLink, Check } from 'lucide-react';
import { api } from '../api/client';
import { artCrop } from '../constants';
import { useCardModal } from '../stores/cardModal';
import Decklist, { DeckVariantBar } from '../components/commanders/Decklist';
import { variantTitle } from '../components/commanders/logic';
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
  const [params, setParams] = useSearchParams();
  const variant = { theme: params.get('theme') || '', bracket: params.get('bracket') || '', budget: params.get('budget') || '' };
  const variantQuery = new URLSearchParams(Object.entries(variant).filter(([, v]) => v)).toString();
  const [vd, setVd] = useState(null); // variante chargée : { query, data } | { query, error }
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [notice, setNotice] = useState(null);
  const [wish, setWish] = useState(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);

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

  // Variante du deck (thème / niveau / prix) : seule la decklist se recharge.
  useEffect(() => {
    if (!variantQuery) return undefined;
    let cancelled = false;
    setVd({ query: variantQuery });
    api(`/commanders/${id}/deck?${variantQuery}`)
      .then((r) => { if (!cancelled) setVd({ query: variantQuery, data: r }); })
      .catch((err) => { if (!cancelled) setVd({ query: variantQuery, error: err.message }); });
    return () => { cancelled = true; };
  }, [id, variantQuery]);

  // Choix dans l'URL (partage), sans empiler l'historique : « Retour » ramène à la liste.
  const setVariant = (patch) => {
    setWish(null);
    setParams((cur) => {
      const next = new URLSearchParams(cur);
      for (const [k, v] of Object.entries(patch)) (v ? next.set(k, v) : next.delete(k));
      return next;
    }, { replace: true });
  };

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
      const r = await api(`/commanders/${id}/missing-to-wishlist${variantQuery ? `?${variantQuery}` : ''}`, { method: 'POST' });
      setWish(r.missing === 0
        ? 'Tu possèdes déjà tout le deck moyen.'
        : `${r.added} carte(s) ajoutée(s) à la wishlist${r.added < r.missing ? ` (${r.missing - r.added} y étaient déjà)` : ''}.`);
    } catch (e) {
      setWish(e.message);
    } finally {
      setBusy(false);
    }
  }

  // « Construire avec » : enregistre le deck moyen (ou la variante affichée) comme deck.
  async function createDeck(title) {
    setCreating(true);
    setWish(null);
    try {
      const name = variantQuery ? `${d.commander.name} · ${title.replace(/^Deck /, '')}` : d.commander.name;
      const r = await api(`/commanders/${id}/build${variantQuery ? `?${variantQuery}` : ''}`, { method: 'POST', body: { name } });
      navigate(`/decks/${r.id}`, { state: { unknown: r.unknown } });
    } catch (e) {
      setWish(e.message);
      setCreating(false);
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
                  {e.themes.map((t) => {
                    const on = variant.theme === t.slug;
                    return (
                      <button
                        key={t.slug} type="button" aria-pressed={on}
                        onClick={() => {
                          setVariant({ theme: on ? '' : t.slug });
                          document.getElementById('deck')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs ${on ? 'bg-gold-500/15 text-gold-200 ring-1 ring-inset ring-gold-500/40' : 'bg-slate-700/80 hover:bg-slate-600'}`}
                      >
                        {t.name} <span className={on ? 'text-gold-300' : 'text-slate-400'}>{t.count}</span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Un thème affiche le deck moyen de ce commandant dans ce thème.
                  {variant.theme && (
                    <>
                      {' '}
                      <Link to={`/commanders?mode=themes&theme=${variant.theme}`} className="text-gold-300 hover:text-gold-200 underline">
                        Autres commandants du thème « {e.themes.find((t) => t.slug === variant.theme)?.name || variant.theme} »
                      </Link>
                    </>
                  )}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3 items-start">
        <div className="lg:col-span-2 space-y-4 min-w-0">
          {c.pairing !== 'background' && (() => {
            const title = variantTitle(variant, e?.themes?.find((t) => t.slug === variant.theme)?.name);
            const controls = <DeckVariantBar variant={variant} themes={e?.themes || []} onChange={setVariant} />;
            const shown = !variantQuery
              ? { deck: d.deck, coverage: d.coverage, numDecks: e?.numDecks }
              : vd?.query === variantQuery && vd.data;
            if (shown?.deck && shown.coverage) {
              return (
                <Decklist
                  commanderName={c.name} deck={shown.deck} coverage={shown.coverage} title={title} numDecks={shown.numDecks}
                  controls={controls} onBuild={buildWith} building={busy} buildMsg={wish}
                  onCreate={() => createDeck(title)} creating={creating}
                />
              );
            }
            const loading = variantQuery && vd?.query === variantQuery && !vd.data && !vd.error;
            return (
              <section id="deck" className={`${panel} scroll-mt-20`}>
                <h2 className="font-display text-2xl font-semibold text-slate-50 mb-3">{title}</h2>
                {controls}
                <p className="text-sm text-slate-400">
                  {loading ? 'Chargement de la variante… (première demande : environ 1 s, le temps d\'interroger EDHREC)'
                    : vd?.error && variantQuery ? vd.error
                      : variantQuery ? 'EDHREC n\'a pas de deck pour cette combinaison. Assouplis un critère.'
                        : 'Pas de deck moyen EDHREC pour ce commandant.'}
                </p>
              </section>
            );
          })()}
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
