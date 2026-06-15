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
