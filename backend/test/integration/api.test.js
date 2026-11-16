import test from 'node:test';
import assert from 'node:assert/strict';

// Tests d'intégration : nécessitent une vraie base Postgres + Redis.
// Activés uniquement si RUN_DB_TESTS=1 (la CI fournit les services). En local sans
// base, toute la suite est ignorée → `npm test` reste exécutable partout.
const RUN = process.env.RUN_DB_TESTS === '1';

// Extrait la valeur du cookie refresh_token d'une réponse.
function refreshCookie(res) {
  for (const c of res.headers['set-cookie'] || []) {
    const m = c.match(/refresh_token=([^;]+)/);
    if (m) return m[1];
  }
  return null;
}

test('intégration API (DB + Redis)', { skip: RUN ? false : 'RUN_DB_TESTS!=1' }, async (t) => {
  // Secrets/flags AVANT d'importer l'app (lus à l'import / à la signature).
  process.env.JWT_SECRET ||= 'integration-secret-integration-secret-xx';
  process.env.JWT_REFRESH_SECRET ||= 'integration-refresh-integration-refresh-x';
  process.env.COOKIE_SECURE = 'false'; // supertest en HTTP
  process.env.TRUST_PROXY = '0';       // pas de proxy en test
  const { mkdtemp } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const updatesDir = await mkdtemp(`${tmpdir()}/mtg-updates-`);
  process.env.UPDATES_DIR = updatesDir; // dossier d'échange avec l'agent hôte
  const { mkdir: mkdirp } = await import('node:fs/promises');
  await mkdirp(`${updatesDir}/requests`);

  const request = (await import('supertest')).default;
  const { pool } = await import('../../src/config/db.js');
  const { redis } = await import('../../src/config/redis.js');
  const { default: app } = await import('../../src/app.js');

  t.after(async () => {
    const { rm } = await import('node:fs/promises');
    await rm(updatesDir, { recursive: true, force: true });
    await pool.end().catch(() => {});
    await redis.quit().catch(() => {});
  });

  // Base propre + une carte seedée (ensureCard la trouvera → pas d'appel Scryfall)
  await pool.query('TRUNCATE collection_entries, refresh_tokens, users, cards RESTART IDENTITY CASCADE');
  const scryfallId = '11111111-1111-1111-1111-111111111111';
  await pool.query('INSERT INTO cards (scryfall_id, name) VALUES ($1, $2)', [scryfallId, 'Test Bolt']);

  const agent = request.agent(app);
  let accessToken;

  await t.test('register (1er compte) → 201 + accessToken admin', async () => {
    const res = await agent.post('/api/auth/register')
      .send({ email: 'admin@test.io', password: 'Password1', display_name: 'Admin' });
    assert.equal(res.status, 201);
    assert.ok(res.body.accessToken, 'accessToken renvoyé');
    assert.equal(res.body.user.is_admin, true);
    accessToken = res.body.accessToken;
  });

  await t.test('me → 200 avec le bon email', async () => {
    const res = await agent.get('/api/auth/me').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'admin@test.io');
  });

  await t.test('me sans token → 401', async () => {
    const res = await agent.get('/api/auth/me');
    assert.equal(res.status, 401);
  });

  await t.test('adjust ajoute la carte seedée (sans Scryfall)', async () => {
    const res = await agent.post('/api/collection/adjust')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ scryfall_id: scryfallId, delta: 1, finish: 'nonfoil' });
    assert.equal(res.status, 200);
  });

  await t.test('collection : la carte est listée, stats à 1', async () => {
    const res = await agent.get('/api/collection').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.stats.cardCount, 1);
    assert.equal(res.body.entries.length, 1);
  });

  await t.test('filtre finition=foil exclut l\'entrée nonfoil', async () => {
    const res = await agent.get('/api/collection?finish=foil').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.entries.length, 0);
  });

  await t.test('groups by set → tableau', async () => {
    const res = await agent.get('/api/collection/groups?by=set').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.ok(Array.isArray(res.body.groups));
  });

  await t.test('refresh tourne le token (cookie)', async () => {
    const res = await agent.post('/api/auth/refresh');
    assert.equal(res.status, 200);
    assert.ok(res.body.accessToken);
  });

  await t.test('réutilisation d\'un refresh tourné → révocation de la famille', async () => {
    process.env.REFRESH_GRACE_MS = '0'; // pas de fenêtre de grâce pour ce test
    try {
      const login = await request(app).post('/api/auth/login').send({ email: 'admin@test.io', password: 'Password1' });
      const t1 = refreshCookie(login);
      assert.ok(t1, 'cookie de login');

      const r1 = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${t1}`);
      assert.equal(r1.status, 200);
      const t2 = refreshCookie(r1);
      assert.ok(t2);

      // t1 a déjà été tourné → le re-présenter = vol présumé → 401
      const reuse = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${t1}`);
      assert.equal(reuse.status, 401);

      // et le successeur légitime t2 est lui aussi invalidé (famille révoquée)
      const after = await request(app).post('/api/auth/refresh').set('Cookie', `refresh_token=${t2}`);
      assert.equal(after.status, 401);
    } finally {
      delete process.env.REFRESH_GRACE_MS;
    }
  });

  await t.test('admin status → réservé admin, renvoie santé + réglages', async () => {
    const res = await agent.get('/api/admin/status').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.health.db, true);
    assert.ok(res.body.settings.price_job_hours);
    assert.match(res.body.version, /^\d+\.\d+\.\d+/);
  });

  await t.test('health → expose la version applicative', async () => {
    const res = await request(app).get('/api/health');
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'ok');
    assert.match(res.body.version, /^\d+\.\d+\.\d+/);
  });

  await t.test('updates : release plus récente détectée, cache, erreur non mise en cache', async () => {
    const { APP_VERSION } = await import('../../src/config/version.js');
    const realFetch = globalThis.fetch;
    let calls = 0;
    let reply = () => new Response(JSON.stringify({
      tag_name: 'v99.0.0', name: 'v99.0.0', body: '## Notes', html_url: 'https://example.test/r', published_at: '2026-11-16T00:00:00Z',
    }), { status: 200 });
    globalThis.fetch = async (url, opts) => {
      if (String(url).startsWith('https://api.github.com/')) { calls += 1; return reply(); }
      return realFetch(url, opts);
    };
    const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`);
    try {
      await redis.del('updates:latest');
      const checked = await auth(agent.post('/api/admin/updates/check'));
      assert.equal(checked.status, 200);
      assert.equal(checked.body.current, APP_VERSION);
      assert.equal(checked.body.latest.version, '99.0.0');
      assert.equal(checked.body.latest.notes, '## Notes');
      assert.equal(checked.body.updateAvailable, true);
      assert.ok(checked.body.checkedAt);

      const cachedRes = await auth(agent.get('/api/admin/updates'));
      assert.equal(cachedRes.body.latest.version, '99.0.0');
      assert.equal(calls, 1, 'GET servi depuis Redis');

      // même version que l'instance → pas de mise à jour
      reply = () => new Response(JSON.stringify({ tag_name: `v${APP_VERSION}`, html_url: 'x' }), { status: 200 });
      assert.equal((await auth(agent.post('/api/admin/updates/check'))).body.updateAvailable, false);

      // aucune release publiée → latest null
      reply = () => new Response('{}', { status: 404 });
      const none = await auth(agent.post('/api/admin/updates/check'));
      assert.equal(none.body.latest, null);
      assert.equal(none.body.updateAvailable, false);

      // GitHub en erreur → erreur remontée, dernière release connue conservée,
      // erreur mise en cache (le GET suivant n'appelle pas GitHub)
      reply = () => new Response(JSON.stringify({ tag_name: 'v99.0.0', html_url: 'x' }), { status: 200 });
      await auth(agent.post('/api/admin/updates/check'));
      reply = () => new Response('{}', { status: 503 });
      const failed = await auth(agent.post('/api/admin/updates/check'));
      assert.equal(failed.status, 200);
      assert.match(failed.body.error, /GitHub API 503/);
      assert.equal(failed.body.latest.version, '99.0.0');
      assert.equal(failed.body.updateAvailable, true);
      const before = calls;
      const afterFail = await auth(agent.get('/api/admin/updates'));
      assert.match(afterFail.body.error, /GitHub API 503/);
      assert.equal(calls, before, 'erreur servie depuis le cache');

      // job quotidien : un échec fait échouer le job ; un succès renvoie un résumé compact
      const { checkForUpdates } = await import('../../src/services/updates.js');
      await assert.rejects(checkForUpdates(), /GitHub API 503/);
      reply = () => new Response(JSON.stringify({ tag_name: 'v99.0.0', body: 'long notes', html_url: 'x' }), { status: 200 });
      assert.deepEqual(await checkForUpdates(), { current: APP_VERSION, latest: '99.0.0', updateAvailable: true });
    } finally {
      globalThis.fetch = realFetch;
      await redis.del('updates:latest');
    }
  });

  await t.test('updates/apply : demande déposée, verrou, statut agent, refus sans mise à jour', async () => {
    const { readFile, writeFile, rm, stat } = await import('node:fs/promises');
    const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`);
    const realFetch = globalThis.fetch;
    let tag = 'v99.0.0';
    globalThis.fetch = async (url, opts) => (String(url).startsWith('https://api.github.com/')
      ? new Response(JSON.stringify({ tag_name: tag, html_url: 'x' }), { status: 200 })
      : realFetch(url, opts));
    try {
      await auth(agent.post('/api/admin/updates/check'));

      const idle = await auth(agent.get('/api/admin/updates/progress'));
      assert.deepEqual(idle.body, { available: true, pending: null, status: null, running: false, log: [] });

      const ok = await auth(agent.post('/api/admin/updates/apply'));
      assert.equal(ok.status, 202);
      assert.equal(ok.body.to, '99.0.0');
      assert.ok(ok.body.requestedAt);
      const req = JSON.parse(await readFile(`${updatesDir}/requests/request.json`, 'utf8'));
      assert.equal(req.action, 'update');
      assert.equal(req.target, undefined, "la cible n'est jamais transmise à l'agent");

      // verrou : seconde demande refusée tant que la première n'est pas consommée
      const dup = await auth(agent.post('/api/admin/updates/apply'));
      assert.equal(dup.status, 409);
      assert.match(dup.body.error, /déjà en attente/);
      assert.ok((await auth(agent.get('/api/admin/updates/progress'))).body.pending.requestedAt);

      // l'agent consomme la demande et publie son statut + log
      await rm(`${updatesDir}/requests/request.json`);
      const now = new Date().toISOString();
      await writeFile(`${updatesDir}/status.json`, JSON.stringify({ state: 'running', step: 'build', from: '1.0.0', to: '99.0.0', startedAt: now, updatedAt: now }));
      await writeFile(`${updatesDir}/update.log`, 'line 1\nline 2\n');
      const running = await auth(agent.get('/api/admin/updates/progress'));
      assert.equal(running.body.running, true);
      assert.equal(running.body.status.step, 'build');
      assert.deepEqual(running.body.log, ['line 1', 'line 2']);
      assert.equal((await auth(agent.post('/api/admin/updates/apply'))).status, 409, 'refus pendant un run');

      // statut "running" périmé (agent mort) → plus bloquant
      const old = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
      await writeFile(`${updatesDir}/status.json`, JSON.stringify({ state: 'running', updatedAt: old }));
      assert.equal((await auth(agent.get('/api/admin/updates/progress'))).body.running, false);
      assert.equal((await auth(agent.post('/api/admin/updates/apply'))).status, 202);
      await rm(`${updatesDir}/requests/request.json`);

      // instance à jour → rien à appliquer
      tag = 'v1.0.0';
      await auth(agent.post('/api/admin/updates/check'));
      const none = await auth(agent.post('/api/admin/updates/apply'));
      assert.equal(none.status, 409);
      await assert.rejects(stat(`${updatesDir}/requests/request.json`));
    } finally {
      globalThis.fetch = realFetch;
      await redis.del('updates:latest');
    }
  });

  await t.test('updates/apply : dossier agent absent → 503 explicite', async () => {
    const { rename } = await import('node:fs/promises');
    const auth = (req) => req.set('Authorization', `Bearer ${accessToken}`);
    const realFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ tag_name: 'v99.0.0', html_url: 'x' }), { status: 200 });
    await rename(updatesDir, `${updatesDir}.off`);
    try {
      await auth(agent.post('/api/admin/updates/check'));
      assert.equal((await auth(agent.get('/api/admin/updates/progress'))).body.available, false);
      const res = await auth(agent.post('/api/admin/updates/apply'));
      assert.equal(res.status, 503);
      assert.match(res.body.error, /non installé/);
    } finally {
      await rename(`${updatesDir}.off`, updatesDir);
      globalThis.fetch = realFetch;
      await redis.del('updates:latest');
    }
  });

  await t.test('updates : non authentifié → 401', async () => {
    const res = await request(app).get('/api/admin/updates');
    assert.equal(res.status, 401);
  });

  await t.test('users : admin → 200 ; compte non admin → 403 (requireAdmin partagé)', async () => {
    const list = await agent.get('/api/auth/users').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(list.status, 200);
    const created = await agent.post('/api/auth/users').set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'user@test.io', password: 'Password1', display_name: 'User' });
    assert.equal(created.status, 201);
    const login = await request(app).post('/api/auth/login').send({ email: 'user@test.io', password: 'Password1' });
    const res = await request(app).get('/api/auth/users').set('Authorization', `Bearer ${login.body.accessToken}`);
    assert.equal(res.status, 403);
  });
});

