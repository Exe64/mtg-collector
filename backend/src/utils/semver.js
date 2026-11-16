// Minimal semver handling for stable X.Y.Z versions (optional leading "v").
// Pre-release/build suffixes are ignored: only stable releases are compared.

/** "v1.2.3" → [1, 2, 3], or null if not a version. */
export function parseVersion(v) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? '').trim());
  return m ? m.slice(1).map(Number) : null;
}

/** -1 if a < b, 0 if equal, 1 if a > b. Throws on invalid input. */
export function compareVersions(a, b) {
  const pa = parseVersion(a);
  const pb = parseVersion(b);
  if (!pa || !pb) throw new Error(`invalid version: ${pa ? b : a}`);
  for (let i = 0; i < 3; i += 1) {
    if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
  }
  return 0;
}
