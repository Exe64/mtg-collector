import { readFileSync } from 'node:fs';

// Single source of truth: backend/package.json (bumped by `npm run release`).
// APP_VERSION env var overrides it (e.g. `git describe` injected at deploy time).
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
export const APP_VERSION = process.env.APP_VERSION || pkg.version;
