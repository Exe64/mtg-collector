import { open, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

// Backend ↔ host agent protocol (deploy/updater/), through a host folder mounted at /updates.
// The folder and the agent's files are root-owned; the backend (uid 1000) can only write in
// requests/, so it can't plant a symlink that the root agent would write through.
//   requests/request.json  written here (exclusive create = lock), consumed by the agent. Its content
//                 is informative only: the agent never reads it, it resolves the target itself.
//   status.json   written by the agent: { state, step, from, to, message, startedAt, updatedAt, finishedAt }
//   update.log    agent log of the last run (tail exposed to the admin).
// The backend never gets the Docker socket: requesting is all it can do.
const DIR = process.env.UPDATES_DIR || '/updates';
const REQUEST = join(DIR, 'requests', 'request.json');
const STATUS = join(DIR, 'status.json');
const LOG = join(DIR, 'update.log');
const STALE_MS = 60 * 60 * 1000; // a "running" status not refreshed for 1h = agent died mid-run
const LOG_LINES = 60;

// expose: these 503 messages are meant for the admin, even in production.
const httpError = (status, message) => Object.assign(new Error(message), { status, expose: true });

async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return null; }
}

async function logTail() {
  try {
    const lines = (await readFile(LOG, 'utf8')).trimEnd().split('\n');
    return lines.slice(-LOG_LINES);
  } catch { return []; }
}

const isRunning = (s) => s?.state === 'running' && Date.now() - Date.parse(s.updatedAt) < STALE_MS;

/** { available, pending: {requestedAt}|null, status|null, running, log[] } */
export async function readAgentState() {
  let available = true;
  try { await stat(DIR); } catch { available = false; }
  let pending = null;
  try { pending = { requestedAt: (await stat(REQUEST)).mtime.toISOString() }; } catch { /* none */ }
  const status = await readJson(STATUS);
  return { available, pending, status, running: isRunning(status), log: await logTail() };
}

/** Drops an update request for the agent → { requestedAt } (server clock, same host as the agent). 409 if one is pending/running, 503 if no agent folder. */
export async function requestUpdate({ requestedBy }) {
  const state = await readAgentState();
  if (!state.available) throw httpError(503, "Agent de mise à jour non installé (dossier /updates absent)");
  if (state.running) throw httpError(409, 'Une mise à jour est déjà en cours');
  let fh;
  try {
    fh = await open(REQUEST, 'wx'); // fails if a request is already pending
  } catch (err) {
    if (err.code === 'EEXIST') throw httpError(409, 'Une demande de mise à jour est déjà en attente');
    if (err.code === 'ENOENT') throw httpError(503, "Agent de mise à jour non installé (dossier /updates/requests absent)");
    if (err.code === 'EACCES' || err.code === 'EROFS') throw httpError(503, 'Dossier /updates/requests non inscriptible par le backend');
    throw err;
  }
  const requestedAt = new Date().toISOString();
  try {
    await fh.writeFile(`${JSON.stringify({ action: 'update', requestedBy, requestedAt })}\n`);
  } finally {
    await fh.close();
  }
  return { requestedAt };
}
