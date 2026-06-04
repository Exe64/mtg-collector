import cron from 'node-cron';

import { syncCollectionPrices } from './priceSync.js';
import { runSnapshots } from './snapshots.js';

/** Job quotidien : MAJ prix des cartes possédées + snapshots collection/édition. */
export async function runDailyJob() {
  const t0 = Date.now();
  console.log('[daily] démarrage…');
  const updated = await syncCollectionPrices();
  await runSnapshots();
  console.log(`[daily] terminé : ${updated} prix MAJ, snapshots écrits (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

/** Planifie le job à 03:00 UTC (§6.3). */
export function scheduleDailyJob() {
  cron.schedule(
    '0 3 * * *',
    () => {
      runDailyJob().catch((err) => console.error('[daily] échec :', err.message));
    },
    { timezone: 'UTC' },
  );
  console.log('[daily] planifié à 03:00 UTC');
}
