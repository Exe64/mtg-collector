import { redis } from '../config/redis.js';
import { logger } from '../config/logger.js';
import { APP_VERSION } from '../config/version.js';
import { compareVersions, parseVersion } from '../utils/semver.js';

// Source of new versions: GitHub Releases of the upstream repo (public → no token needed).
// UPDATES_REPO lets a fork point at itself; UPDATES_GITHUB_TOKEN raises the rate limit
// (60 → 5000 req/h) or gives access to a private repo.
const REPO = process.env.UPDATES_REPO || 'Exe64/mtg-collector';
const CACHE_KEY = 'updates:latest';
const CACHE_TTL = 26 * 3600; // daily check + margin
const ERROR_TTL = 10 * 60;   // retry a failed check at most every 10 min

/** Fetches the latest stable release (GitHub excludes drafts/pre-releases). null if none. */
export async function fetchLatestRelease() {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'mtg-collector-update-check',
  };
  if (process.env.UPDATES_GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.UPDATES_GITHUB_TOKEN}`;

  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers, signal: AbortSignal.timeout(10000),
  });
  if (res.status === 404) return null; // no release published yet
  if (!res.ok) throw new Error(`GitHub API ${res.status}`);
  const r = await res.json();
  if (!parseVersion(r.tag_name)) throw new Error(`unexpected release tag: ${r.tag_name}`);
  return {
    tag: r.tag_name,
    version: r.tag_name.replace(/^v/, ''),
    name: r.name || r.tag_name,
    notes: r.body || '',
    url: r.html_url,
    publishedAt: r.published_at,
  };
}

function withComparison(entry) {
  const { latest } = entry;
  let updateAvailable = false;
  try {
    updateAvailable = Boolean(latest) && compareVersions(latest.version, APP_VERSION) > 0;
  } catch { /* non-semver APP_VERSION (e.g. dev build) → never offer an update */ }
  return { current: APP_VERSION, ...entry, updateAvailable };
}

// Redis is a cache here: unavailable → behave as a miss / skip the write.
async function readCache() {
  try {
    const hit = await redis.get(CACHE_KEY);
    return hit === null ? null : JSON.parse(hit);
  } catch { return null; }
}
async function writeCache(entry, ttl) {
  try { await redis.set(CACHE_KEY, JSON.stringify(entry), 'EX', ttl); } catch { /* best-effort */ }
}

/**
 * Update status for the admin: { current, latest, checkedAt, updateAvailable, error? }.
 * Served from cache unless `force`. A failed check keeps the last known release and is
 * cached briefly, so a GitHub outage / rate limit doesn't trigger a call on every page load.
 */
export async function getUpdateStatus({ force = false } = {}) {
  const prev = await readCache();
  if (prev && !force) return withComparison(prev);
  try {
    const entry = { latest: await fetchLatestRelease(), checkedAt: new Date().toISOString() };
    await writeCache(entry, CACHE_TTL);
    return withComparison(entry);
  } catch (err) {
    logger.warn({ err: err.message }, 'vérification des mises à jour impossible');
    const entry = { latest: prev?.latest ?? null, checkedAt: prev?.checkedAt ?? null, error: err.message };
    await writeCache(entry, ERROR_TTL);
    return withComparison(entry);
  }
}

/** Daily job: refresh the cache; a failed check fails the job (visible in jobState). */
export async function checkForUpdates() {
  const status = await getUpdateStatus({ force: true });
  if (status.error) throw new Error(status.error);
  if (status.updateAvailable) logger.info(`mise à jour disponible : ${status.current} → ${status.latest.version}`);
  return { current: status.current, latest: status.latest?.version ?? null, updateAvailable: status.updateAvailable };
}
