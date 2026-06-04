import { runDailyJob } from '../services/dailyJob.js';
import { pool } from '../config/db.js';
import { redis } from '../config/redis.js';

try {
  await runDailyJob();
} catch (err) {
  console.error('[daily] échec :', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
  redis.quit();
}
