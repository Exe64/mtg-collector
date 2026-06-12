import { Router } from 'express';

import { requireAuth } from '../middleware/auth.js';
import { parseDeckText, fetchMoxfieldDeck, checkDeck } from '../services/deckCheck.js';

const router = Router();
router.use(requireAuth);

// POST /api/decks/check  { url } | { text }  → cartes manquantes vs collection
router.post('/check', async (req, res, next) => {
  try {
    const url = String(req.body?.url || '').trim();
    const text = String(req.body?.text || '');
    let deckCards;
    if (url) {
      deckCards = await fetchMoxfieldDeck(url);
    } else if (text.trim()) {
      deckCards = parseDeckText(text);
    } else {
      return res.status(400).json({ error: 'Fournis une URL Moxfield ou une liste de cartes.' });
    }
    if (!deckCards.length) {
      return res.status(400).json({ error: 'Aucune carte reconnue dans la liste.' });
    }
    return res.json(await checkDeck(req.user.id, deckCards));
  } catch (err) {
    return next(err);
  }
});

export default router;
