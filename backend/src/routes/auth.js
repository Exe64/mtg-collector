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
  return { id: u.id, email: u.email, display_name: u.display_name };
}

// Spec §6.5 : 10 tentatives / 15 min par IP (s'appuie sur trust proxy)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de tentatives, réessayez plus tard' },
});

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { email, password, display_name } = req.body || {};
    const errors = validateCredentials(email, password);
    if (errors.length) return res.status(400).json({ error: errors.join(' ; ') });

    const normalizedEmail = email.toLowerCase();
    const exists = await query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail]);
    if (exists.rowCount) return res.status(409).json({ error: 'Email déjà utilisé' });

    const password_hash = await hashPassword(password);
    const { rows } = await query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name`,
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
      'SELECT id, email, display_name, password_hash FROM users WHERE email = $1',
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
      'SELECT id, email, display_name FROM users WHERE id = $1',
      [req.user.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Utilisateur introuvable' });
    res.json({ user: publicUser(rows[0]) });
  } catch (err) {
    next(err);
  }
});

export default router;
