import jwt from 'jsonwebtoken';
import crypto from 'node:crypto';

import { query } from '../config/db.js';

const ACCESS_TTL = '30m';
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

// Émet un token. familyId null → nouvelle lignée (login) ; sinon rotation dans la lignée.
export async function issueRefreshToken(userId, familyId = null) {
  const token = crypto.randomBytes(48).toString('hex');
  const expiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  const { rows } = await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, family_id)
     VALUES ($1, $2, $3, COALESCE($4::uuid, gen_random_uuid()))
     RETURNING family_id`,
    [userId, hashToken(token), expiresAt, familyId],
  );
  return { token, expiresAt, familyId: rows[0].family_id };
}

/**
 * Rotation avec détection de réutilisation :
 *  - token inconnu / expiré → refus (null).
 *  - token actif → marqué « utilisé » + émission du successeur dans la même famille.
 *  - token déjà utilisé → s'il l'a été dans la fenêtre de grâce (onglets concurrents),
 *    on émet quand même un token frais ; sinon c'est une réutilisation (vol présumé)
 *    et on révoque TOUTE la famille.
 */
export async function rotateRefreshToken(presentedToken) {
  const graceMs = Number(process.env.REFRESH_GRACE_MS ?? 30000);
  const tokenHash = hashToken(presentedToken);
  const { rows } = await query(
    'SELECT id, user_id, family_id, expires_at, used_at FROM refresh_tokens WHERE token_hash = $1',
    [tokenHash],
  );
  const rec = rows[0];
  if (!rec) return null;

  if (new Date(rec.expires_at) < new Date()) {
    await query('DELETE FROM refresh_tokens WHERE id = $1', [rec.id]);
    return null;
  }

  if (rec.used_at) {
    if (Date.now() - new Date(rec.used_at).getTime() <= graceMs) {
      const fresh = await issueRefreshToken(rec.user_id, rec.family_id);
      return { userId: rec.user_id, ...fresh };
    }
    // Réutilisation hors grâce → vol présumé : on coupe toute la lignée.
    await query('DELETE FROM refresh_tokens WHERE family_id = $1', [rec.family_id]);
    return null;
  }

  await query('UPDATE refresh_tokens SET used_at = now() WHERE id = $1', [rec.id]);
  const fresh = await issueRefreshToken(rec.user_id, rec.family_id);
  return { userId: rec.user_id, ...fresh };
}

export async function revokeRefreshToken(presentedToken) {
  if (!presentedToken) return;
  await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hashToken(presentedToken)]);
}
