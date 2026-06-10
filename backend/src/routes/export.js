import { Router } from 'express';
import PDFDocument from 'pdfkit';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { UNIT_EUR } from '../services/pricing.js';

const router = Router();

const LANG_LABEL = {
  en: 'English', fr: 'French', de: 'German', it: 'Italian', es: 'Spanish', pt: 'Portuguese',
  ja: 'Japanese', ko: 'Korean', ru: 'Russian', zhs: 'Chinese Simplified', zht: 'Chinese Traditional',
};
// Conditions Cardmarket -> codes Moxfield (M/NM/LP/MP/HP) pour l'export CSV.
const COND_TO_MOXFIELD = {
  MT: 'M', NM: 'NM', EX: 'LP', GD: 'MP', LP: 'LP', PL: 'MP', PO: 'HP',
};
const today = () => new Date().toISOString().slice(0, 10);

async function fetchRows(userId) {
  const { rows } = await query(
    `SELECT e.quantity, e.finish, e.condition, e.language, e.location, e.notes, e.acquired_price,
            c.name, c.set_code, c.set_name, c.collector_number,
            (${UNIT_EUR})::numeric(10,2) AS unit_price_eur
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1
     ORDER BY ((${UNIT_EUR}) * e.quantity) DESC NULLS LAST, c.name`,
    [userId],
  );
  return rows;
}

function csvField(v, sep) {
  let s = v == null ? '' : String(v);
  // Anti-injection de formule (Excel/LibreOffice) : un champ commençant par
  // = + - @ (ou tab/CR) peut être exécuté à l'ouverture. On le préfixe d'une
  // apostrophe, neutralisée à l'affichage par le tableur.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  const re = sep === ';' ? /[";\n]/ : /[",\n]/;
  return re.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/export/csv  (format Moxfield)
router.get('/csv', requireAuth, async (req, res, next) => {
  try {
    const rows = await fetchRows(req.user.id);
    const header = 'Count,Tradelist Count,Name,Edition,Condition,Language,Foil,Tags,Last Modified,Collector Number,Alter,Proxy,Purchase Price';
    const lines = rows.map((r) => [
      r.quantity, '', r.name, (r.set_code || '').toUpperCase(), COND_TO_MOXFIELD[r.condition] || 'NM',
      LANG_LABEL[r.language] || r.language,
      r.finish === 'nonfoil' ? '' : r.finish,
      '', '', r.collector_number, 'False', 'False',
      r.acquired_price ?? '',
    ].map((v) => csvField(v, ',')).join(','));

    const csv = [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="collection_${today()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/sell.csv  (mise en vente : prix trend EUR, conditions Cardmarket)
router.get('/sell.csv', requireAuth, async (req, res, next) => {
  try {
    const rows = (await fetchRows(req.user.id)).filter((r) => r.unit_price_eur != null);
    const header = 'Name;Set Name;Set Code;Collector Number;Language;Condition;Foil;Quantity;Trend Price EUR;Comments';
    const lines = rows.map((r) => [
      r.name, r.set_name, (r.set_code || '').toUpperCase(), r.collector_number,
      r.language, r.condition, r.finish === 'nonfoil' ? '' : 'X',
      r.quantity, r.unit_price_eur, r.notes || '',
    ].map((v) => csvField(v, ';')).join(';'));

    const csv = [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="mise_en_vente_${today()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// Tableau PDFKit (une ligne par entrée, saut de page + en-tête répété).
function drawTable(doc, columns, rows) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const rowH = 15;
  let y = doc.y;

  const header = () => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor('#000');
    let x = left;
    for (const col of columns) {
      doc.text(col.label, x + 2, y + 3, { width: col.width - 4, align: col.align || 'left', lineBreak: false });
      x += col.width;
    }
    doc.moveTo(left, y + rowH).lineTo(right, y + rowH).strokeColor('#999').lineWidth(0.5).stroke();
    y += rowH;
  };

  header();
  doc.font('Helvetica').fontSize(8).fillColor('#222');
  for (const row of rows) {
    if (y + rowH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      header();
      doc.font('Helvetica').fontSize(8).fillColor('#222');
    }
    let x = left;
    for (const col of columns) {
      doc.text(col.fmt ? col.fmt(row) : String(row[col.key] ?? ''),
        x + 2, y + 3, { width: col.width - 4, align: col.align || 'left', lineBreak: false, ellipsis: true });
      x += col.width;
    }
    y += rowH;
  }
}

// GET /api/export/pdf  (rapport de valorisation, recevable pour assurance)
router.get('/pdf', requireAuth, async (req, res, next) => {
  try {
    const rows = await fetchRows(req.user.id);
    const totalCards = rows.reduce((s, r) => s + r.quantity, 0);
    const totalValue = rows.reduce((s, r) => s + (Number(r.unit_price_eur) || 0) * r.quantity, 0);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="inventaire_valorise_${today()}.pdf"`);

    const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
    doc.pipe(res);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#000')
      .text('Rapport de valorisation — collection Magic: The Gathering');
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(9).fillColor('#444')
      .text(`Propriétaire : ${req.user.email}`)
      .text(`Date : ${today()}`)
      .text(`Total : ${totalCards} cartes (${rows.length} entrées) — Valeur de marché : ${totalValue.toFixed(2)} €`);
    doc.moveDown(0.2);
    doc.fontSize(7.5).fillColor('#777')
      .text('Valeurs de marché Cardmarket (EUR) via Scryfall à la date ci-dessus. Document d\'inventaire valorisé, non certifié.');
    doc.moveDown(0.5);

    const columns = [
      { key: 'name', label: 'Nom', width: 168 },
      { label: 'Éd.', width: 52, fmt: (r) => (r.set_code || '').toUpperCase() },
      { key: 'collector_number', label: 'N°', width: 32 },
      { key: 'quantity', label: 'Qté', width: 28, align: 'right' },
      { key: 'finish', label: 'Fin.', width: 46 },
      { key: 'condition', label: 'État', width: 34 },
      { key: 'language', label: 'Lng', width: 28 },
      { key: 'location', label: 'Emplacement', width: 92 },
      { key: 'notes', label: 'Notes', width: 92 },
      { label: 'PU €', width: 48, align: 'right', fmt: (r) => (r.unit_price_eur ?? '—').toString() },
      { label: 'Total €', width: 52, align: 'right', fmt: (r) => (r.unit_price_eur != null ? (Number(r.unit_price_eur) * r.quantity).toFixed(2) : '—') },
    ];
    drawTable(doc, columns, rows);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#000')
      .text(`Total : ${totalCards} cartes — ${totalValue.toFixed(2)} €`, { align: 'right' });

    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
