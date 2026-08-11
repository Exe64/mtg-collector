// Cotes EUR d'une impression. `eur_etched` sert de repli quand une impression
// n'existe qu'en foil gravé (pas de `eur_foil` chez Scryfall).
export function cardPrices(card) {
  const p = card?.prices || {};
  const num = (v) => (v == null || v === '' ? null : Number(v));
  const foil = num(p.eur_foil);
  const etched = num(p.eur_etched);
  return { nonfoil: num(p.eur), foil: foil ?? etched, etched: foil == null && etched != null };
}

// Prix de référence d'une impression (tri, coût de complétion) : le non-foil, ou
// le foil pour les impressions foil-only — c'est alors le seul exemplaire achetable.
export function refPrice(card) {
  const { nonfoil, foil } = cardPrices(card);
  return nonfoil ?? foil ?? null;
}

const fmt = (v) => `${v.toFixed(2)} €`;

// Double prix : non-foil en vert, foil en or. Une impression qui n'existe que dans
// une finition n'affiche que celle-ci ; « — » si aucune cote.
export default function CardPrice({ card, className = '' }) {
  const { nonfoil, foil, etched } = cardPrices(card);
  if (nonfoil == null && foil == null) return <span className={`text-slate-500 ${className}`}>—</span>;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      {nonfoil != null && <span className="text-emerald-400" title="Cote non-foil">{fmt(nonfoil)}</span>}
      {foil != null && (
        <span className="text-gold-400" title={etched ? 'Cote foil gravé' : 'Cote foil'}>
          {fmt(foil)} {etched ? 'gravé' : 'foil'}
        </span>
      )}
    </span>
  );
}
