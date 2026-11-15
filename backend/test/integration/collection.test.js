import test from 'node:test';
import assert from 'node:assert/strict';

// Mutations d'inventaire (adjust, patch, bulk, annulation). Mêmes prérequis que
// api.test.js : RUN_DB_TESTS=1 + Postgres/Redis migrés.
const RUN = process.env.RUN_DB_TESTS === '1';

test('intégration mutations de collection', { skip: RUN ? false : 'RUN_DB_TESTS!=1' }, async (t) => {
  process.env.JWT_SECRET ||= 'integration-secret-integration-secret-xx';
  process.env.JWT_REFRESH_SECRET ||= 'integration-refresh-integration-refresh-x';
  process.env.COOKIE_SECURE = 'false';
  process.env.TRUST_PROXY = '0';

  const request = (await import('supertest')).default;
  const { pool } = await import('../../src/config/db.js');
  const { redis } = await import('../../src/config/redis.js');
  const { default: app } = await import('../../src/app.js');

  t.after(async () => {
    await pool.end().catch(() => {});
    await redis.quit().catch(() => {});
  });

  await pool.query('TRUNCATE collection_entries, collection_log, refresh_tokens, users, cards RESTART IDENTITY CASCADE');
  const bolt = '22222222-2222-2222-2222-222222222222';
  await pool.query('INSERT INTO cards (scryfall_id, name) VALUES ($1, $2)', [bolt, 'Test Bolt']);

  const reg = await request(app).post('/api/auth/register')
    .send({ email: 'inv@test.io', password: 'Password1', display_name: 'Inv' });
  assert.equal(reg.status, 201);
  const auth = { Authorization: `Bearer ${reg.body.accessToken}` };
  const api = (method, url) => request(app)[method](url).set(auth);

  const qty = async () => (await pool.query('SELECT COALESCE(SUM(quantity), 0)::int AS q FROM collection_entries')).rows[0].q;
  const logSum = async () => (await pool.query('SELECT COALESCE(SUM(quantity_delta), 0)::int AS s FROM collection_log')).rows[0].s;
  const adjust = (delta, extra = {}) => api('post', '/api/collection/adjust').send({ scryfall_id: bolt, delta, ...extra });

  await t.test('adjust concurrent : 10 × +1 en parallèle → quantité 10, journal = 10', async () => {
    const res = await Promise.all(Array.from({ length: 10 }, () => adjust(1)));
    assert.ok(res.every((r) => r.status === 200), res.map((r) => r.status).join(','));
    assert.equal(await qty(), 10);
    assert.equal(await logSum(), 10);
  });

  await t.test('adjust concurrent : 4 × -3 en parallèle → plancher 0, journal = inventaire', async () => {
    const res = await Promise.all(Array.from({ length: 4 }, () => adjust(-3)));
    assert.ok(res.every((r) => r.status === 200));
    assert.equal(await qty(), 0);
    assert.equal(await logSum(), 0);
  });

  await t.test('adjust -1 sur variante absente → 0, aucun journal', async () => {
    const before = (await pool.query('SELECT COUNT(*)::int AS n FROM collection_log')).rows[0].n;
    const res = await adjust(-1);
    assert.equal(res.body.quantity, 0);
    assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM collection_log')).rows[0].n, before);
  });

  await t.test('validation : :id non entier → 400 (patch, delete, undo, wishlist)', async () => {
    assert.equal((await api('patch', '/api/collection/abc').send({ notes: 'x' })).status, 400);
    assert.equal((await api('delete', '/api/collection/1;drop')).status, 400);
    assert.equal((await api('post', '/api/collection/log/x/undo')).status, 400);
    assert.equal((await api('delete', '/api/wishlist/abc')).status, 400);
  });

  await t.test('validation : acquired_at invalide → 400, date ISO → 200', async () => {
    await adjust(1);
    const { rows: [e] } = await pool.query('SELECT id FROM collection_entries LIMIT 1');
    assert.equal((await api('patch', `/api/collection/${e.id}`).send({ acquired_at: 'hier' })).status, 400);
    const ok = await api('patch', `/api/collection/${e.id}`).send({ acquired_at: '2026-01-31' });
    assert.equal(ok.status, 200);
    assert.equal((await api('patch', `/api/collection/${e.id}`).send({ acquired_at: null })).status, 200);
  });

  // --- Étape 4 : déplacements journalisés ---------------------------------
  const entry = async (where = '') => (await pool.query(`SELECT * FROM collection_entries ${where} ORDER BY id LIMIT 1`)).rows[0];
  const lastLog = async (n) => (await pool.query('SELECT * FROM collection_log ORDER BY id DESC LIMIT $1', [n])).rows.reverse();
  const reset = () => pool.query('TRUNCATE collection_entries, collection_log RESTART IDENTITY');

  await t.test('PATCH emplacement → paire move (−n ancienne, +n nouvelle), Σ journal = inventaire', async () => {
    await reset();
    await adjust(3);
    const e = await entry();
    const res = await api('patch', `/api/collection/${e.id}`).send({ location: 'Classeur A' });
    assert.equal(res.status, 200);
    const [out, inn] = await lastLog(2);
    assert.deepEqual([out.source, out.quantity_delta, out.location], ['move', -3, '']);
    assert.deepEqual([inn.source, inn.quantity_delta, inn.location], ['move', 3, 'Classeur A']);
    assert.equal(await logSum(), await qty());
  });

  await t.test('PATCH état + quantité → paire move + delta edit sur la nouvelle variante', async () => {
    const e = await entry();
    const res = await api('patch', `/api/collection/${e.id}`).send({ condition: 'LP', quantity: 5 });
    assert.equal(res.status, 200);
    const rows = await lastLog(3);
    assert.deepEqual(rows.map((r) => [r.source, r.quantity_delta, r.condition]), [['move', -3, 'NM'], ['move', 3, 'LP'], ['edit', 2, 'LP']]);
    assert.equal(await logSum(), await qty());
  });

  await t.test('PATCH notes seules → aucune ligne de journal', async () => {
    const before = (await lastLog(1))[0].id;
    const e = await entry();
    assert.equal((await api('patch', `/api/collection/${e.id}`).send({ notes: 'promo' })).status, 200);
    assert.equal((await lastLog(1))[0].id, before);
  });

  await t.test('PATCH vers une variante existante → 409, rien de journalisé', async () => {
    await adjust(1); // variante par défaut (NM, sans emplacement) recréée
    const before = (await lastLog(1))[0].id;
    const lp = await entry("WHERE condition = 'LP'");
    const res = await api('patch', `/api/collection/${lp.id}`).send({ condition: 'NM', location: '' });
    assert.equal(res.status, 409);
    assert.equal((await lastLog(1))[0].id, before);
  });

  await t.test('bulk avec conflit → une ligne déplacée, un conflit, journal cohérent', async () => {
    // Entrées NM/'' (1) et LP/'Classeur A' (5). 1er bulk location='Boîte' → NM/Boîte + LP/Boîte ;
    // 2e bulk condition=LP → NM/Boîte entre en conflit avec LP/Boîte (déjà LP, inchangée).
    const { rows } = await pool.query('SELECT id FROM collection_entries ORDER BY id');
    const res = await api('post', '/api/collection/bulk').send({ ids: rows.map((r) => r.id), patch: { location: 'Boîte' } });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { updated: 2, conflicts: 0 });
    const res2 = await api('post', '/api/collection/bulk').send({ ids: rows.map((r) => r.id), patch: { condition: 'LP' } });
    assert.equal(res2.status, 200);
    assert.deepEqual(res2.body, { updated: 1, conflicts: 1 });
    assert.equal(await logSum(), await qty());
  });

  await t.test('Journal : move exposé avec sa variante, non annulable ; undo move → 400', async () => {
    const res = await api('get', '/api/collection/log');
    const move = res.body.log.find((r) => r.source === 'move');
    assert.ok(move);
    assert.equal(move.undoable, false);
    assert.ok('location' in move && 'condition' in move);
    assert.equal((await api('post', `/api/collection/log/${move.id}/undo`)).status, 400);
  });

  // --- Étape 5 : annulation et import --------------------------------------
  await t.test('undo d\'un adjust → inverse appliqué, double undo → 409', async () => {
    await reset();
    await adjust(2);
    const [log] = await lastLog(1);
    const res = await api('post', `/api/collection/log/${log.id}/undo`);
    assert.equal(res.status, 200);
    assert.equal(res.body.applied, -2);
    assert.equal(await qty(), 0);
    assert.equal((await api('post', `/api/collection/log/${log.id}/undo`)).status, 409);
    assert.equal((await api('post', '/api/collection/log/999999/undo')).status, 404);
  });

  await pool.query("INSERT INTO sets (code, name) VALUES ('tst', 'Test Set') ON CONFLICT DO NOTHING");
  await pool.query(
    "INSERT INTO cards (scryfall_id, name, set_code, collector_number) VALUES ($1, 'Test Elf', 'tst', '7')",
    ['33333333-3333-3333-3333-333333333333'],
  );
  const csv = (body) => api('post', '/api/import/csv').field('mode', body.mode).attach('file', Buffer.from(body.csv), 'c.csv');

  await t.test('import merge (format ManaBox) → ajoute à l\'existant', async () => {
    await reset();
    await adjust(1);
    const res = await csv({ mode: 'merge', csv: `Name,Set code,Collector number,Quantity,Foil,Condition,Language,Scryfall ID\nTest Bolt,,,2,normal,near_mint,English,${bolt}\nTest Elf,tst,7,1,foil,near_mint,English,\n` });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.imported, 2);
    assert.equal(await qty(), 4);
    assert.equal(await logSum(), 4);
  });

  await t.test('import replace (format Moxfield) → remplace tout, journal = inventaire', async () => {
    const res = await csv({ mode: 'replace', csv: '"Count","Name","Edition","Condition","Language","Foil","Collector Number"\n"3","Test Elf","tst","Near Mint","English","","7"\n' });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.imported, 1);
    assert.equal(await qty(), 3);
    assert.equal(await logSum(), 3);
  });

  // --- Étape 6 : lots ------------------------------------------------------
  await t.test('import : ligne au nom seul → repli resolveLocal, dry-run cohérent', async () => {
    const body = 'Name,Quantity\nTest Elf,1\nCarte Inexistante Zzz,1\nTest Bolt,0\n';
    const dry = await api('post', '/api/import/csv').field('dryRun', 'true').attach('file', Buffer.from(body), 'c.csv');
    assert.equal(dry.status, 200);
    assert.deepEqual([dry.body.resolvedLocally, dry.body.needsScryfall, dry.body.invalid], [1, 1, 1]);
  });

  await t.test('syncCollectionPrices : un lot Scryfall → prix mis à jour + historique du jour', async () => {
    const { syncCollectionPrices } = await import('../../src/services/priceSync.js');
    const realFetch = globalThis.fetch;
    const tracked = (await pool.query(
      'SELECT DISTINCT c.scryfall_id, c.name FROM cards c JOIN collection_entries e ON e.card_id = c.id',
    )).rows;
    globalThis.fetch = async () => new Response(JSON.stringify({
      object: 'list',
      not_found: [],
      data: tracked.map((c) => ({ id: c.scryfall_id, name: c.name, prices: { eur: '1.50' }, legalities: {} })),
    }), { status: 200, headers: { 'content-type': 'application/json' } });
    try {
      assert.equal(await syncCollectionPrices(), tracked.length);
    } finally {
      globalThis.fetch = realFetch;
    }
    const { rows } = await pool.query('SELECT prices_eur FROM cards WHERE scryfall_id = $1', [tracked[0].scryfall_id]);
    assert.equal(Number(rows[0].prices_eur), 1.5);
    const hist = await pool.query('SELECT COUNT(*)::int AS n FROM card_price_history WHERE snapshot_date = CURRENT_DATE');
    assert.equal(hist.rows[0].n, tracked.length);
  });
});

