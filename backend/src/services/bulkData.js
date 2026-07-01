import { createWriteStream, createReadStream } from 'node:fs';
import { mkdir, unlink } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';

import streamJson from 'stream-json';
import streamArrayMod from 'stream-json/streamers/StreamArray.js';

import * as scryfall from './scryfall.js';
import { mapScryfallCard, upsertCardsBatch } from './cards.js';
import { syncSets } from './sets.js';
import { query } from '../config/db.js';
import { logger } from '../config/logger.js';

const { parser } = streamJson;
const { streamArray } = streamArrayMod;

const DIR = path.resolve('bulk-data');
const BATCH = 500;

// Upsert d'un lot tolérant aux pannes : si le lot atomique échoue (≥ 1 carte
// fautive — overflow numérique, donnée aberrante…), on rejoue carte par carte
// pour n'ignorer QUE la/les fautive(s). Le sync ne s'arrête plus sur une carte.
// Retourne le nombre de cartes réellement upsertées.
async function upsertResilient(batch) {
  try {
    await upsertCardsBatch(batch);
    return batch.length;
  } catch {
    let ok = 0;
    for (const card of batch) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await upsertCardsBatch([card]);
        ok += 1;
      } catch (e) {
        logger.warn({ scryfall_id: card.scryfall_id, name: card.name, err: e.message }, 'sync bulk : carte ignorée');
      }
    }
    return ok;
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

  // 2. Métadonnées du dump du jour.
  const meta = await scryfall.getBulkData('default_cards');
  if (!meta?.download_uri) throw new Error('bulk-data « default_cards » introuvable');

  // 3. Téléchargement en streaming vers le disque (jamais 450 Mo en RAM).
  await mkdir(DIR, { recursive: true });
  const file = path.join(DIR, 'default_cards.json');
  const res = await fetch(meta.download_uri, {
    headers: { 'User-Agent': scryfall.USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Téléchargement bulk échoué : ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));

  // 4. Parse streaming + upsert par lots (tolérant aux pannes).
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

  const source = createReadStream(file).pipe(parser()).pipe(streamArray());
  for await (const { value } of source) {
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

  await unlink(file).catch(() => {});
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
  const meta = await scryfall.getBulkData('all_cards');
  if (!meta?.download_uri) throw new Error('bulk-data « all_cards » introuvable');

  await mkdir(DIR, { recursive: true });
  const file = path.join(DIR, 'all_cards.json');
  const res = await fetch(meta.download_uri, {
    headers: { 'User-Agent': scryfall.USER_AGENT, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Téléchargement bulk FR échoué : ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));

  let batch = [];
  let matched = 0;
  const flush = async () => {
    if (!batch.length) return;
    matched += await applyFrenchBatch(batch);
    batch = [];
    onProgress?.(matched);
  };

  const source = createReadStream(file).pipe(parser()).pipe(streamArray());
  for await (const { value } of source) {
    if (value?.lang !== 'fr') continue;
    const name_fr = frenchName(value);
    if (!name_fr || !value.set || !value.collector_number) continue;
    batch.push({ set: value.set, number: value.collector_number, name_fr });
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  await unlink(file).catch(() => {});

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
