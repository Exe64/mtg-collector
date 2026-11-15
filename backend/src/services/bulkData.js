import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';
import path from 'node:path';

import * as scryfall from './scryfall.js';
import { mapScryfallCard, upsertResilient } from './cards.js';
import { syncSets } from './sets.js';
import { CATALOG_KEY } from './commanders.js';
import { query } from '../config/db.js';
import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';

const DIR = path.resolve('bulk-data');
const BATCH = 500;

// Scryfall ne sert plus les bulks en tableau JSON (`download_uri` a disparu) :
// uniquement en JSONL gzippé (`jsonl_download_uri`), un objet par ligne.
// Télécharge sur disque (jamais le dump entier en RAM) puis yield objet par objet.
async function* streamBulk(type, filename) {
  const meta = await scryfall.getBulkData(type);
  if (!meta?.jsonl_download_uri) throw new Error(`bulk-data « ${type} » introuvable`);

  await mkdir(DIR, { recursive: true });
  const file = path.join(DIR, filename);
  const res = await fetch(meta.jsonl_download_uri, {
    headers: { 'User-Agent': scryfall.USER_AGENT },
  });
  if (!res.ok) throw new Error(`Téléchargement bulk « ${type} » échoué : ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));

  try {
    const lines = createInterface({
      input: createReadStream(file).pipe(createGunzip()),
      crlfDelay: Infinity,
    });
    for await (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }
  } finally {
    await unlink(file).catch(() => {});
  }
}

/**
 * Source primaire des données cartes (décision #4/#7) : télécharge le fichier
 * `default_cards` de Scryfall (~450 Mo), le parse en streaming et upsert par lots.
 * À lancer hebdomadairement + à la demande. Le job prix (Sprint 3) le réutilise.
 */
export async function syncBulk({ onProgress } = {}) {
  // 1. Sets d'abord : satisfait la FK cards.set_code et alimente le browse.
  await syncSets();

  // 2-3. Téléchargement du dump du jour + parse streaming, upsert par lots.
  let batch = [];
  let count = 0;
  let skipped = 0;
  const flush = async () => {
    if (!batch.length) return;
    const ok = await upsertResilient(batch);
    count += ok;
    skipped += batch.length - ok;
    batch = [];
    onProgress?.(count);
  };

  for await (const value of streamBulk('default_cards', 'default_cards.jsonl.gz')) {
    let mapped;
    try {
      mapped = mapScryfallCard(value);
    } catch (e) {
      skipped += 1;
      logger.warn({ id: value?.id, err: e.message }, 'sync bulk : mapping échoué');
      continue;
    }
    batch.push(mapped);
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  // Légalités, rangs EDHREC et prix ont pu changer : le catalogue commandants est recalculé.
  await redis.del(CATALOG_KEY);

  if (skipped) logger.warn(`sync bulk : ${skipped} carte(s) ignorée(s) (voir logs ci-dessus)`);
  logger.info(`sync bulk terminé : ${count} cartes, ${skipped} ignorée(s)`);
  return { count, skipped };
}

// Nom français d'une impression Scryfall « lang:fr ». Retombe sur les faces
// (DFC/MDFC : `printed_name` est porté par chaque face, pas au niveau carte).
function frenchName(c) {
  if (c.printed_name) return c.printed_name;
  const faces = c.card_faces?.map((f) => f.printed_name).filter(Boolean);
  return faces?.length ? faces.join(' // ') : null;
}

// Applique un lot de noms FR par (set, n° collecteur). Best-effort : un lot
// fautif est ignoré (log) sans interrompre le sync. Casts ::text explicites
// pour lever l'ambiguïté de type sur les paramètres de VALUES.
async function applyFrenchBatch(batch) {
  if (!batch.length) return 0;
  const params = [];
  const rows = batch.map((r) => {
    params.push(r.set, r.number, r.name_fr);
    const i = params.length;
    return `($${i - 2}::text, $${i - 1}::text, $${i}::text)`;
  });
  try {
    const { rowCount } = await query(
      `UPDATE cards AS c SET name_fr = v.name_fr
       FROM (VALUES ${rows.join(', ')}) AS v(set_code, collector_number, name_fr)
       WHERE lower(c.set_code) = lower(v.set_code)
         AND c.collector_number = v.collector_number`,
      params,
    );
    return rowCount;
  } catch (e) {
    logger.warn({ err: e.message, size: batch.length }, 'sync FR : lot ignoré');
    return 0;
  }
}

/**
 * Noms français : streame le bulk `all_cards` (~2 Go), ne retient que les
 * impressions `lang:fr`, et remplit `cards.name_fr` par (set, n° collecteur).
 * Puis propage le nom FR à toutes les impressions d'un même oracle_id — une
 * carte imprimée en FR quelque part est nommée en FR partout, même sur une
 * édition jamais sortie en français.
 * À lancer APRÈS syncBulk (qui crée les lignes anglaises canoniques).
 */
export async function syncFrenchNames({ onProgress } = {}) {
  let batch = [];
  let matched = 0;
  const flush = async () => {
    if (!batch.length) return;
    matched += await applyFrenchBatch(batch);
    batch = [];
    onProgress?.(matched);
  };

  for await (const value of streamBulk('all_cards', 'all_cards.jsonl.gz')) {
    if (value?.lang !== 'fr') continue;
    const name_fr = frenchName(value);
    if (!name_fr || !value.set || !value.collector_number) continue;
    batch.push({ set: value.set, number: value.collector_number, name_fr });
    if (batch.length >= BATCH) await flush();
  }
  await flush();

  // Propagation par oracle_id : les impressions restées sans FR héritent du nom
  // FR d'une autre impression de la même carte (oracle_id NULL exclu).
  const { rowCount: propagated } = await query(
    `UPDATE cards c SET name_fr = src.name_fr
     FROM (SELECT oracle_id, MAX(name_fr) AS name_fr
             FROM cards
            WHERE name_fr IS NOT NULL AND oracle_id IS NOT NULL
            GROUP BY oracle_id) src
     WHERE c.oracle_id = src.oracle_id AND c.name_fr IS NULL`,
  );

  logger.info(`sync FR terminé : ${matched} impression(s) appariée(s), ${propagated} propagée(s) par oracle`);
  return { matched, propagated };
}
