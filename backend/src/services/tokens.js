import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { query } from '../config/db.js';

const ACCESS_TTL = '8h';
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 jours

// --- Access token (JWT court, renvoyé au client en mémoire) ---------------

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TTL },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

// --- Refresh token (opaque, allowlist en base, circule en cookie) ----------

// HMAC plutôt que stockage en clair : une fuite de la table ne donne pas les tokens.
function hashToken(token) {
  return crypto
    .createHmac('sha256', process.env.JWT_REFRESH_SECRET)
    .update(token)
    .digest('hex');
}

export async function issueRefreshToken(userId) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  await query(
    'INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [userId, hashToken(token), expiresAt],
  );
  return { token, expiresAt };
}

/**
 * Rotation : on consomme toujours le token présenté (suppression), puis on en
 * émet un neuf s'il était valide et non expiré. Retourne null sinon.
 */
export async function rotateRefreshToken(presentedToken) {
  const tokenHash = hashToken(presentedToken);
  const { rows } = await query(
    'DELETE FROM refresh_tokens WHERE token_hash = $1 RETURNING user_id, expires_at',
    [tokenHash],
  );
  const record = rows[0];
  if (!record || new Date(record.expires_at) < new Date()) return null;
  const fresh = await issueRefreshToken(record.user_id);
  return { userId: record.user_id, ...fresh };
}

export async function revokeRefreshToken(presentedToken) {
  if (!presentedToken) return;
  await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(presentedToken)]);
}
