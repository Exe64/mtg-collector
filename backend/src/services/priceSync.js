import { query } from '../config/db.js';
import * as scryfall from './scryfall.js';
import { mapScryfallCard, upsertCard } from './cards.js';

const BATCH = 75; // limite Scryfall /cards/collection

/**
 * Met à jour les prix des cartes présentes dans ≥1 collection via
 * POST /cards/collection (lots de 75), puis archive l'historique du jour.
 */
export async function syncCollectionPrices() {
  const { rows } = await query(
    `SELECT DISTINCT c.scryfall_id
     FROM cards c JOIN collection_entries e ON e.card_id = c.id`,
  );

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const data = await scryfall.getCardsCollection(chunk.map((r) => ({ id: r.scryfall_id })));
    for (const raw of data?.data || []) {
      await upsertCard(mapScryfallCard(raw));
      updated += 1;
    }
  }

  await appendCardPriceHistory();
  return updated;
}

/** Archive le prix du jour pour chaque carte possédée (alimente la courbe carte). */
async function appendCardPriceHistory() {
  await query(
    `INSERT INTO card_price_history
       (card_id, snapshot_date, eur, eur_foil, eur_etched, usd, usd_foil)
     SELECT DISTINCT c.id, CURRENT_DATE,
            c.prices_eur, c.prices_eur_foil, c.prices_eur_etched, c.prices_usd, c.prices_usd_foil
     FROM cards c JOIN collection_entries e ON e.card_id = c.id
     ON CONFLICT (card_id, snapshot_date) DO UPDATE SET
       eur        = EXCLUDED.eur,
       eur_foil   = EXCLUDED.eur_foil,
       eur_etched = EXCLUDED.eur_etched,
       usd        = EXCLUDED.usd,
       usd_foil   = EXCLUDED.usd_foil`,
  );
}
