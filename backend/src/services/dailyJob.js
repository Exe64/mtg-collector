import cron from 'node-cron';

import { logger } from '../config/logger.js';
import { query } from '../config/db.js';
import { syncCollectionPrices } from './priceSync.js';
import { syncBulk } from './bulkData.js';
import { runSnapshots } from './snapshots.js';

/** Job quotidien : MAJ prix des cartes possédées + snapshots + purge des refresh tokens. */
export async function runDailyJob() {
  const t0 = Date.now();
  logger.info('job quotidien : démarrage');
  const updated = await syncCollectionPrices();
  await runSnapshots();
  const { rowCount } = await query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
  logger.info(`job quotidien terminé : ${updated} prix MAJ, snapshots écrits, ${rowCount} tokens expirés purgés (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

/** Planifie les jobs : prix quotidien (03:00 UTC) + bulk-data hebdo (dim. 04:00 UTC). */
export function scheduleDailyJob() {
  cron.schedule('0 3 * * *', () => {
    runDailyJob().catch((err) => logger.error({ err: err.message }, 'job quotidien : échec'));
  }, { timezone: 'UTC' });
  logger.info('job quotidien planifié à 03:00 UTC');

  cron.schedule('0 4 * * 0', () => {
    logger.info('sync bulk-data hebdomadaire : démarrage');
    syncBulk()
      .then((r) => logger.info(`sync bulk-data hebdo terminé : ${r.count} cartes`))
      .catch((err) => logger.error({ err: err.message }, 'sync bulk-data hebdo : échec'));
  }, { timezone: 'UTC' });
  logger.info('sync bulk-data hebdomadaire planifié (dimanche 04:00 UTC)');
}
