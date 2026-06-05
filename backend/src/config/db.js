import pg from 'pg';
import { logger } from './logger.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'erreur inattendue du pool PostgreSQL');
});

export const query = (text, params) => pool.query(text, params);
