import { verifyAccessToken } from '../services/tokens.js';
import { query } from '../config/db.js';

/**
 * Protège les routes /api/* : exige un access token JWT valide en header
 *   Authorization: Bearer <accessToken>
 * Renseigne req.user = { id, email } pour l'isolation par utilisateur.
 */
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ error: 'Token manquant' });
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

/** À chaîner après requireAuth : refuse si l'utilisateur n'est pas administrateur. */
export async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.is_admin) return res.status(403).json({ error: "Réservé à l'administrateur" });
    return next();
  } catch (err) {
    return next(err);
  }
}
