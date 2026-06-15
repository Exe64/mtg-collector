import cron from 'node-cron';

import { logger } from '../config/logger.js';
import { query } from '../config/db.js';
import { syncCollectionPrices } from './priceSync.js';
import { syncBulk } from './bulkData.js';
import { runSnapshots } from './snapshots.js';
import { evaluateAlerts } from './alerts.js';
import { getSettings } from './settings.js';

// Dead-man's-switch : ping un check externe (succès / échec). No-op si HEALTHCHECK_PRICE_URL absent.
async function pingHealthcheck(suffix = '') {
  const base = process.env.HEALTHCHECK_PRICE_URL;
  if (!base) return;
  try {
    await fetch(`${base.replace(/\/$/, '')}${suffix}`, { signal: AbortSignal.timeout(10000) });
  } catch { /* best-effort */ }
}

/** Job quotidien : MAJ prix des cartes possédées + snapshots + alertes + purge des refresh tokens. */
export async function runDailyJob() {
  const t0 = Date.now();
  logger.info('job quotidien : démarrage');
  try {
    const updated = await syncCollectionPrices();
    await runSnapshots();
    const alertsFired = await evaluateAlerts();
    const { rowCount } = await query('DELETE FROM refresh_tokens WHERE expires_at < NOW()');
    logger.info(`job quotidien terminé : ${updated} prix MAJ, snapshots écrits, ${alertsFired} alerte(s) déclenchée(s), ${rowCount} tokens expirés purgés (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    await pingHealthcheck();
  } catch (err) {
    await pingHealthcheck('/fail');
    throw err;
  }
}

const clampHours = (h) => Math.min(Math.max(Number(h) || 12, 1), 24);
const priceExpr = (h) => (clampHours(h) >= 24 ? '0 0 * * *' : `0 */${clampHours(h)} * * *`);

let priceTask = null;

/** (Re)planifie le job prix selon la périodicité (heures). Appelable à chaud. */
export function applyPriceSchedule(hours) {
  if (priceTask) priceTask.stop();
  priceTask = cron.schedule(priceExpr(hours), () => {
    runDailyJob().catch((err) => logger.error({ err: err.message }, 'job prix : échec'));
  }, { timezone: 'UTC' });
  logger.info(`job prix planifié toutes les ${clampHours(hours)}h (UTC)`);
}

/** Planifie les jobs au boot : prix (périodicité réglable) + bulk-data hebdo (dim. 04:00 UTC). */
export async function scheduleDailyJob() {
  let hours = 12;
  try { hours = (await getSettings()).price_job_hours; } catch { /* défauts */ }
  applyPriceSchedule(hours);

  cron.schedule('0 4 * * 0', () => {
    logger.info('sync bulk-data hebdomadaire : démarrage');
    syncBulk()
      .then((r) => logger.info(`sync bulk-data hebdo terminé : ${r.count} cartes`))
      .catch((err) => logger.error({ err: err.message }, 'sync bulk-data hebdo : échec'));
  }, { timezone: 'UTC' });
  logger.info('sync bulk-data hebdomadaire planifié (dimanche 04:00 UTC)');
}
