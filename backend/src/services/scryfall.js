import PQueue from 'p-queue';

const BASE = 'https://api.scryfall.com';
const USER_AGENT = process.env.SCRYFALL_USER_AGENT || 'MagicCollectionManager/1.0';

// Scryfall : 10 req/s max, ~50-100ms entre requêtes (§8.2).
// On reste prudemment sous la limite : 8 requêtes / seconde, concurrence 4.
const queue = new PQueue({ interval: 1000, intervalCap: 8, concurrency: 4 });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const HEADERS = { 'User-Agent': USER_AGENT, Accept: 'application/json' };

async function doFetch(path, attempt = 0) {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS });

  // 429 → backoff exponentiel (respecte Retry-After si présent)
  if (res.status === 429) {
    if (attempt >= 4) {
      throw Object.assign(new Error('Scryfall 429 (max retries)'), { status: 429 });
    }
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    const wait = retryAfter * 1000 || Math.min(2 ** attempt * 250, 4000);
    await sleep(wait);
    return doFetch(path, attempt + 1);
  }

  // 404 → pas de résultat (ex. recherche vide) : on remonte null
  if (res.status === 404) return null;

  if (!res.ok) {
    const body = await res.text();
    throw Object.assign(new Error(`Scryfall ${res.status}: ${body.slice(0, 200)}`), {
      status: res.status,
    });
  }
  return res.json();
}

const request = (path) => queue.add(() => doFetch(path));

// POST (utilisé par /cards/collection pour la sync prix par lots de 75)
async function doPost(path, body, attempt = 0) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (res.status === 429) {
    if (attempt >= 4) throw Object.assign(new Error('Scryfall 429 (max retries)'), { status: 429 });
    const retryAfter = Number(res.headers.get('retry-after')) || 0;
    await sleep(retryAfter * 1000 || Math.min(2 ** attempt * 250, 4000));
    return doPost(path, body, attempt + 1);
  }
  if (!res.ok) {
    const t = await res.text();
    throw Object.assign(new Error(`Scryfall ${res.status}: ${t.slice(0, 200)}`), { status: res.status });
  }
  return res.json();
}

/** POST /cards/collection — identifiers: [{ id }] (max 75). → { data[], not_found[] } */
export function getCardsCollection(identifiers) {
  return queue.add(() => doPost('/cards/collection', { identifiers }));
}

// --- Endpoints (§8.1) ------------------------------------------------------

export function searchCards(query, page = 1) {
  const q = encodeURIComponent(query);
  return request(`/cards/search?q=${q}&unique=cards&order=name&page=${page}`);
}

export function getCard(scryfallId) {
  return request(`/cards/${encodeURIComponent(scryfallId)}`);
}

/** Toutes les impressions (éditions) d'une carte par nom exact, triées par date. */
export function searchPrints(name) {
  const q = encodeURIComponent(`!"${name}"`);
  return request(`/cards/search?q=${q}&unique=prints&order=released&dir=asc`);
}

export function getSets() {
  return request('/sets');
}

export function getSet(code) {
  return request(`/sets/${encodeURIComponent(code)}`);
}

export function getSetCards(code, page = 1) {
  const q = encodeURIComponent(`set:${code}`);
  return request(`/cards/search?q=${q}&unique=prints&order=set&page=${page}`);
}

/** Métadonnées d'un fichier bulk (default_cards par défaut) → { download_uri, ... } */
export async function getBulkData(type = 'default_cards') {
  const data = await request('/bulk-data');
  return data?.data?.find((b) => b.type === type) || null;
}

export { USER_AGENT };
