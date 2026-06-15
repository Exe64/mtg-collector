import app from './app.js';
import { logger } from './config/logger.js';
import { scheduleDailyJob } from './services/dailyJob.js';

// Refus de démarrer si les secrets JWT sont absents ou trop faibles (échec rapide,
// plutôt qu'une erreur à la première signature de token).
function validateEnv() {
  const problems = [];
  for (const key of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    const v = process.env[key];
    if (!v) problems.push(`${key} manquant`);
    else if (v.length < 32) problems.push(`${key} trop court (< 32 caractères)`);
  }
  if (problems.length) {
    logger.error(`Configuration invalide : ${problems.join(' ; ')}. Démarrage refusé.`);
    process.exit(1);
  }
}
validateEnv();

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  logger.info(`backend à l'écoute sur le port ${PORT}`);
  scheduleDailyJob().catch((err) => logger.error({ err: err.message }, 'planification des jobs : échec'));
});
