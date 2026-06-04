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
    `SELECT e.quantity, e.finish, e.condition, e.language, e.acquired_price,
            c.name, c.set_code, c.collector_number,
            (${UNIT_EUR})::numeric(10,2) AS unit_price_eur
     FROM collection_entries e JOIN cards c ON c.id = e.card_id
     WHERE e.user_id = $1
     ORDER BY c.set_code, c.name`,
    [userId],
  );
  return rows;
}

function csvField(v) {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
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
    ].map(csvField).join(','));

    const csv = [header, ...lines].join('\r\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="collection_${today()}.csv"`);
    res.send(csv);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/pdf
router.get('/pdf', requireAuth, async (req, res, next) => {
  try {
    const rows = await fetchRows(req.user.id);
    const totalCards = rows.reduce((s, r) => s + r.quantity, 0);
    const totalValue = rows.reduce((s, r) => s + (Number(r.unit_price_eur) || 0) * r.quantity, 0);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="collection_${today()}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.pipe(res);

    doc.fontSize(18).text('Collection Magic', { align: 'left' });
    doc.fontSize(10).fillColor('#555')
      .text(`${req.user.email} — ${today()}`)
      .text(`Valeur totale : ${totalValue.toFixed(2)} €  ·  ${totalCards} cartes`);
    doc.moveDown();

    doc.fontSize(9).fillColor('#000');
    rows.forEach((r) => {
      const foil = r.finish === 'nonfoil' ? '' : ` [${r.finish}]`;
      const price = r.unit_price_eur != null ? `${(Number(r.unit_price_eur) * r.quantity).toFixed(2)} €` : '—';
      doc.text(
        `${String(r.quantity).padStart(3)}×  ${r.name}${foil}  (${(r.set_code || '').toUpperCase()} #${r.collector_number})  ${r.condition}/${r.language}  —  ${price}`,
      );
    });

    doc.moveDown();
    doc.fontSize(10).fillColor('#555')
      .text(`Total : ${totalCards} cartes — ${totalValue.toFixed(2)} €`, { align: 'right' });

    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
