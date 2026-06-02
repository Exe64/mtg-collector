import { verifyAccessToken } from '../services/tokens.js';

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
