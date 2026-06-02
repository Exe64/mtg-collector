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

const { parser } = streamJson;
const { streamArray } = streamArrayMod;

const DIR = path.resolve('bulk-data');
const BATCH = 500;

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

  // 4. Parse streaming + upsert par lots.
  let batch = [];
  let count = 0;
  const source = createReadStream(file).pipe(parser()).pipe(streamArray());
  for await (const { value } of source) {
    batch.push(mapScryfallCard(value));
    if (batch.length >= BATCH) {
      await upsertCardsBatch(batch);
      count += batch.length;
      batch = [];
      onProgress?.(count);
    }
  }
  if (batch.length) {
    await upsertCardsBatch(batch);
    count += batch.length;
    onProgress?.(count);
  }

  await unlink(file).catch(() => {});
  return { count };
}
