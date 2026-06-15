import test from 'node:test';
import assert from 'node:assert/strict';

// Tests d'intégration : nécessitent une vraie base Postgres + Redis.
// Activés uniquement si RUN_DB_TESTS=1 (la CI fournit les services). En local sans
// base, toute la suite est ignorée → `npm test` reste exécutable partout.
const RUN = process.env.RUN_DB_TESTS === '1';

test('intégration API (DB + Redis)', { skip: RUN ? false : 'RUN_DB_TESTS!=1' }, async (t) => {
  // Secrets/flags AVANT d'importer l'app (lus à l'import / à la signature).
  process.env.JWT_SECRET ||= 'integration-secret-integration-secret-xx';
  process.env.JWT_REFRESH_SECRET ||= 'integration-refresh-integration-refresh-x';
  process.env.COOKIE_SECURE = 'false'; // supertest en HTTP
  process.env.TRUST_PROXY = '0';       // pas de proxy en test

  const request = (await import('supertest')).default;
  const { pool } = await import('../../src/config/db.js');
  const { redis } = await import('../../src/config/redis.js');
  const { default: app } = await import('../../src/app.js');

  t.after(async () => {
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

  await t.test('admin status → réservé admin, renvoie santé + réglages', async () => {
    const res = await agent.get('/api/admin/status').set('Authorization', `Bearer ${accessToken}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.health.db, true);
    assert.ok(res.body.settings.price_job_hours);
  });
});
