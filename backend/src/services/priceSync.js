import { query } from '../config/db.js';
import * as scryfall from './scryfall.js';
import { mapScryfallCard, upsertCard } from './cards.js';

const BATCH = 75; // limite Scryfall /cards/collection

// Cartes à suivre : possédées ∪ en wishlist ∪ sous alerte active.
// Élargit le périmètre pour que les mouvements wishlist et les alertes de prix
// disposent d'un prix frais et d'un historique, même sur des cartes non possédées.
const TRACKED_CARDS = `
  SELECT card_id FROM collection_entries
  UNION SELECT card_id FROM wishlist
  UNION SELECT card_id FROM price_alerts WHERE active`;

/**
 * Met à jour les prix des cartes suivies (collection, wishlist, alertes) via
 * POST /cards/collection (lots de 75), puis archive l'historique du jour.
 */
export async function syncCollectionPrices() {
  const { rows } = await query(
    `SELECT DISTINCT c.scryfall_id
     FROM cards c WHERE c.id IN (${TRACKED_CARDS})`,
  );

  let updated = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    // eslint-disable-next-line no-await-in-loop -- lots séquentiels (rate-limit Scryfall)
    const data = await scryfall.getCardsCollection(chunk.map((r) => ({ id: r.scryfall_id })));
    for (const raw of data?.data || []) {
      // eslint-disable-next-line no-await-in-loop -- upserts séquentiels volontaires
      await upsertCard(mapScryfallCard(raw));
      updated += 1;
    }
  }

  await appendCardPriceHistory();
  return updated;
}

/** Archive le prix du jour pour chaque carte suivie (alimente la courbe carte). */
async function appendCardPriceHistory() {
  await query(
    `INSERT INTO card_price_history
       (card_id, snapshot_date, eur, eur_foil, eur_etched, usd, usd_foil)
     SELECT c.id, CURRENT_DATE,
            c.prices_eur, c.prices_eur_foil, c.prices_eur_etched, c.prices_usd, c.prices_usd_foil
     FROM cards c WHERE c.id IN (${TRACKED_CARDS})
     ON CONFLICT (card_id, snapshot_date) DO UPDATE SET
       eur        = EXCLUDED.eur,
       eur_foil   = EXCLUDED.eur_foil,
       eur_etched = EXCLUDED.eur_etched,
       usd        = EXCLUDED.usd,
       usd_foil   = EXCLUDED.usd_foil`,
  );
}
