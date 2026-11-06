import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import {
  listAlerts, createAlert, deleteAlert,
  listNotifications, markNotificationsRead,
} from '../services/alerts.js';

const router = Router();
router.use(requireAuth);

const alertSchema = z.object({
  scryfall_id: z.guid({ message: 'scryfall_id invalide' }),
  direction: z.enum(['below', 'above']),
  threshold_eur: z.coerce.number().positive('seuil > 0'),
});

// GET /api/alerts  → alertes de prix de l'utilisateur
router.get('/', async (req, res, next) => {
  try {
    res.json({ alerts: await listAlerts(req.user.id) });
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts  { scryfall_id, direction, threshold_eur }
router.post('/', validateBody(alertSchema), async (req, res, next) => {
  try {
    const { scryfall_id, direction, threshold_eur } = req.body;
    const row = await createAlert(req.user.id, scryfall_id, direction, threshold_eur);
    res.status(201).json({ id: row.id });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/alerts/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await deleteAlert(req.user.id, Number(req.params.id));
    if (!ok) return res.status(404).json({ error: 'Alerte introuvable' });
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

// GET /api/alerts/notifications  → cloche in-app (+ compteur non lues)
router.get('/notifications', async (req, res, next) => {
  try {
    res.json(await listNotifications(req.user.id));
  } catch (err) {
    next(err);
  }
});

// POST /api/alerts/notifications/read  { id? }  → marque lue(s)
router.post('/notifications/read', async (req, res, next) => {
  try {
    await markNotificationsRead(req.user.id, req.body?.id ? Number(req.body.id) : null);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

export default router;
