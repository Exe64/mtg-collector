/* global console, process */
// Vérifie les contrastes WCAG des paires texte/fond de la palette (npm run check:contrast).
import config from '../tailwind.config.js';

const c = config.theme.extend.colors;
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [libellé, premier plan, fond, seuil]
const pairs = [
  ['texte discret / fond', c.slate[500], c.slate[900], 4.5],
  ['texte discret / panneau', c.slate[500], c.slate[800], 4.5],
  ['texte atténué / panneau', c.slate[400], c.slate[800], 4.5],
  ['texte atténué / relevé', c.slate[400], c.slate[700], 4.5],
  ['libellé / bouton ambre', c.slate[900], c.indigo[600], 4.5],
  ['libellé / bouton ambre survol', c.slate[900], c.indigo[500], 4.5],
  ['libellé / bouton or (foil)', c.slate[900], c.gold[600], 4.5],
  ['blanc / segment actif', '#ffffff', c.gold[700], 4.5],
  ['montant / panneau', c.emerald[400], c.slate[800], 4.5],
  ['hausse / fond', c.gain[400], c.slate[900], 4.5],
  ['or signature / panneau', c.gold[300], c.slate[800], 4.5],
  ['bordure de champ / fond', c.edge, c.slate[900], 3],
  ['bordure de champ / panneau', c.edge, c.slate[800], 3],
  ['anneau de focus / panneau', c.gold[400], c.slate[800], 3],
];

let failed = 0;
for (const [label, fg, bg, min] of pairs) {
  const r = ratio(fg, bg);
  const ok = r >= min;
  if (!ok) failed += 1;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${r.toFixed(2)} (min ${min})  ${label}`);
}
process.exit(failed ? 1 : 0);
