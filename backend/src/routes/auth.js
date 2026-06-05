import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';

import { query } from '../config/db.js';
import { requireAuth } from '../middleware/auth.js';
import { hashPassword, comparePassword, validateCredentials } from '../utils/password.js';
import {
  signAccessToken,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
} from '../services/tokens.js';

const router = Router();

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_PATH = '/api/auth';

function setRefreshCookie(res, token, expiresAt) {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE !== 'false',
    sameSite: 'strict',
    path: REFRESH_PATH,
    expires: expiresAt,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE, { path: REFRESH_PATH });
}

function publicUser(u) {
  return { id: u.id, email: u.email, display_name: u.display_name, is_admin: u.is_admin === true };
}

// Réservé à l'administrateur (vérifie le drapeau en base)
async function requireAdmin(req, res, next) {
  try {
    const { rows } = await query('SELECT is_admin FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.is_admin) return res.status(403).json({ error: "Réservé à l'administrateur" });
    return next();
  } catch (err) {
    return next(err);
  }
}

// Spec §6.5 : 10 tentatives / 15 min par IP (s'appuie sur trust proxy)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez plus tard' },
});

// GET /api/auth/setup-status  (public) — true tant qu'aucun compte n'existe
router.get('/setup-status', async (req, res, next) => {
  try {
    const { rows } = await query('SELECT COUNT(*)::int AS n FROM users');
    res.json({ needsSetup: rows[0].n === 0 });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register  (uniquement à la 1re installation → crée l'admin)
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const countRes = await query('SELECT COUNT(*)::int AS n FROM users');
    if (countRes.rows[0].n > 0) {
      return res.status(403).json({ error: "Inscription fermée. Demande un compte à l'administrateur." });
    }

    const { email, password, display_name } = req.body || {};
    const errors = validateCredentials(email, password);
    if (errors.length) return res.status(400).json({ error: errors.join(' ; ') });

    const normalizedEmail = email.toLowerCase();
    const exists = await query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email déjà utilisé' });

    const password_hash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, is_admin)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id, email, display_name, is_admin`,
      [normalizedEmail, password_hash, display_name || null],
    );
    const user = rows[0];

    const { token, expiresAt } = await issueRefreshToken(user.id);
    setRefreshCookie(res, token, expiresAt);
    res.status(201).json({ user: publicUser(user), accessToken: signAccessToken(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email et mot de passe requis' });
    }

    const { rows } = await query(
      'SELECT id, email, display_name, is_admin, password_hash FROM users WHERE email = $1',
      [email.toLowerCase()],
    );
    const user = rows[0];
    if (!user || !(await comparePassword(password, user.password_hash))) {
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const { token, expiresAt } = await issueRefreshToken(user.id);
    setRefreshCookie(res, token, expiresAt);
    res.json({ user: publicUser(user), accessToken: signAccessToken(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/refresh  (rotation du refresh token)
router.post('/refresh', async (req, res, next) => {
  try {
    const presented = req.cookies?.[REFRESH_COOKIE];
    if (!presented) return res.status(401).json({ error: 'Refresh token manquant' });

    const rotated = await rotateRefreshToken(presented);
    if (!rotated) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Refresh token invalide ou expiré' });
    }

    const { rows } = await query(
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [rotated.userId],
    );
    const user = rows[0];
    if (!user) {
      clearRefreshCookie(res);
      return res.status(401).json({ error: 'Utilisateur introuvable' });
    }

    setRefreshCookie(res, rotated.token, rotated.expiresAt);
    res.json({ accessToken: signAccessToken(user) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req, res, next) => {
  try {
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    clearRefreshCookie(res);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  (route protégée — bootstrap de session côté frontend)
router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, email, display_name, is_admin FROM users WHERE id = $1',
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// --- Gestion des comptes (administrateur) ---------------------------------

// GET /api/auth/users
router.get('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      'SELECT id, email, display_name, is_admin, created_at, last_login FROM users ORDER BY id',
    );
    res.json({ users: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/users  (crée un compte sans connecter l'admin)
router.post('/users', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { email, password, display_name, is_admin } = req.body || {};
    const errors = validateCredentials(email, password);
    if (errors.length) return res.status(400).json({ error: errors.join(' ; ') });

    const normalizedEmail = email.toLowerCase();
    const exists = await query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email déjà utilisé' });

    const password_hash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name, is_admin)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, display_name, is_admin`,
      [normalizedEmail, password_hash, display_name || null, is_admin === true],
    );
    res.status(201).json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/auth/users/:id  (pas son propre compte)
router.delete('/users/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    if (Number(req.params.id) === req.user.id) {
      return res.status(400).json({ error: 'Impossible de supprimer son propre compte' });
    }
    const { rowCount } = await query('DELETE FROM users WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Introuvable' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
