import { syncFrenchNames } from '../services/bulkData.js';
import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';

const t0 = Date.now();
console.log('[fr] démarrage de la synchronisation des noms français (« all_cards »)…');

try {
  const { matched, propagated } = await syncFrenchNames({
    onProgress: (n) => process.stdout.write(`\r[fr] ${n} impressions FR appariées…`),
  });
  console.log(`\n[fr] terminé : ${matched} appariées, ${propagated} propagées en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} catch (err) {
  console.error('\n[fr] échec :', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
  redis.quit();
}
