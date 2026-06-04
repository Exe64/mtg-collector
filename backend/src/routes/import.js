import { Router } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';

import { requireAuth } from '../middleware/auth.js';
import { importCsv } from '../services/importer.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// POST /api/import/csv  (multipart : champ "file", + "mode" merge|replace)
router.post('/csv', requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fichier CSV manquant (champ "file")' });
    const mode = req.body.mode === 'replace' ? 'replace' : 'merge';

    let rows;
    try {
      rows = parse(req.file.buffer.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
        relax_column_count: true,
      });
    } catch (e) {
      return res.status(400).json({ error: `CSV illisible : ${e.message}` });
    }

    const report = await importCsv(req.user.id, rows, mode);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
