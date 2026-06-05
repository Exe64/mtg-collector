import cron from 'node-cron';

import { logger } from '../config/logger.js';
import { syncCollectionPrices } from './priceSync.js';
import { runSnapshots } from './snapshots.js';

/** Job quotidien : MAJ prix des cartes possédées + snapshots collection/édition. */
export async function runDailyJob() {
  const t0 = Date.now();
  logger.info('job quotidien : démarrage');
  const updated = await syncCollectionPrices();
  await runSnapshots();
  logger.info(`job quotidien terminé : ${updated} prix MAJ, snapshots écrits (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

/** Planifie le job à 03:00 UTC (§6.3). */
export function scheduleDailyJob() {
  cron.schedule(
    '0 3 * * *',
    () => {
      runDailyJob().catch((err) => logger.error({ err: err.message }, 'job quotidien : échec'));
    },
    { timezone: 'UTC' },
  );
  logger.info('job quotidien planifié à 03:00 UTC');
}
