import { syncBulk } from '../services/bulkData.js';
import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';

const t0 = Date.now();
console.log('[bulk] démarrage de la synchronisation « default_cards »…');

try {
  const { count } = await syncBulk({
    onProgress: (n) => process.stdout.write(`\r[bulk] ${n} cartes traitées…`),
  });
  console.log(`\n[bulk] terminé : ${count} cartes en ${((Date.now() - t0) / 1000).toFixed(0)} s`);
} catch (err) {
  console.error('\n[bulk] échec :', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
  redis.quit();
}
