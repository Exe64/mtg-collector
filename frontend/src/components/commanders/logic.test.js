import test from 'node:test';
import assert from 'node:assert/strict';

import {
  creatureTypes, colorMatch, applyFilters, relaxSuggestions, sortCommanders,
  scoreCommander, matchmake, deckGroup, deckText, EMPTY_FILTERS, EMPTY_ANSWERS,
} from './logic.js';

const NOW = Date.parse('2026-10-21');
const C = (o) => ({
  oracle_id: o.id, name: o.id, name_fr: null, oracle_text: '', type_line: 'Legendary Creature — Human',
  color_identity: [], cmc: 3, eur: 1, rank: 100, game_changer: false, pairing: null, released_at: '2020-01-01', ...o,
});

test('creatureTypes : face avant, sous-types', () => {
  assert.deepEqual(creatureTypes('Legendary Creature — Elf Druid'), ['Elf', 'Druid']);
  assert.deepEqual(creatureTypes('Legendary Enchantment — Background'), []);
  assert.deepEqual(creatureTypes('Legendary Planeswalker — Teferi'), []);
});

test('colorMatch : exactement / incluant / au plus', () => {
  assert.ok(colorMatch(['W', 'U'], ['U', 'W'], 'exact'));
  assert.ok(!colorMatch(['W', 'U', 'B'], ['W', 'U'], 'exact'));
  assert.ok(colorMatch([], [], 'exact'));
  assert.ok(colorMatch(['W', 'U', 'B'], ['W', 'U'], 'include'));
  assert.ok(colorMatch(['W'], ['W', 'U'], 'atmost'));
  assert.ok(!colorMatch(['W', 'B'], ['W', 'U'], 'atmost'));
});

test('applyFilters + relaxSuggestions', () => {
  const list = [
    C({ id: 'a', color_identity: ['G'], eur: 2, type_line: 'Legendary Creature — Elf Druid' }),
    C({ id: 'b', color_identity: ['G'], eur: 30, game_changer: true }),
    C({ id: 'c', color_identity: ['R'], eur: 1, oracle_text: 'Create a Goblin token' }),
  ];
  const owned = new Set(['c']);
  const f = { ...EMPTY_FILTERS, colors: ['G'], priceMax: '5' };
  assert.deepEqual(applyFilters(list, f, owned).map((c) => c.oracle_id), ['a']);
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, q: 'goblin' }, owned).map((c) => c.oracle_id), ['c']);
  assert.deepEqual(applyFilters(list, { ...EMPTY_FILTERS, creatureType: 'elf' }, owned).map((c) => c.oracle_id), ['a']);
  const none = { ...EMPTY_FILTERS, colors: ['G'], ownedOnly: true };
  assert.equal(applyFilters(list, none, owned).length, 0);
  assert.deepEqual(relaxSuggestions(list, none, owned), [{ key: 'ownedOnly', count: 2 }, { key: 'colors', count: 1 }]);
});

test('sortCommanders : popularité, prix (sans prix en dernier), nouveauté', () => {
  const list = [C({ id: 'x', rank: null, eur: null }), C({ id: 'y', rank: 5, eur: 3, released_at: '2026-01-01' }), C({ id: 'z', rank: 2, eur: 1 })];
  assert.deepEqual(sortCommanders(list, 'popular').map((c) => c.oracle_id), ['z', 'y', 'x']);
  assert.deepEqual(sortCommanders(list, 'price').map((c) => c.oracle_id), ['z', 'y', 'x']);
  assert.equal(sortCommanders(list, 'new')[0].oracle_id, 'y');
});

test('scoreCommander : règles et raisons', () => {
  const ctx = { owned: new Set(['own']), theme: new Set(['thm']), now: NOW };
  const base = { ...EMPTY_ANSWERS };

  // Historique : jamais proposé seul
  assert.equal(scoreCommander(C({ id: 'bg', pairing: 'background' }), base, ctx), null);

  // Couleurs : exact 30, sous-ensemble 10, hors couleurs exclu
  const ug = { ...base, colors: ['U', 'G'] };
  const exact = scoreCommander(C({ id: 'e', color_identity: ['G', 'U'], rank: null }), ug, ctx);
  assert.equal(exact.score, 30);
  assert.deepEqual(exact.reasons, ['Exactement tes couleurs']);
  assert.equal(scoreCommander(C({ id: 's', color_identity: ['G'], rank: null }), ug, ctx).score, 10);
  assert.equal(scoreCommander(C({ id: 'o', color_identity: ['R'] }), ug, ctx), null);

  // Thème : +35 dans le thème, -15 sinon
  const th = { ...base, theme: 'elves' };
  assert.equal(scoreCommander(C({ id: 'thm', rank: null }), th, ctx).score, 35);
  assert.equal(scoreCommander(C({ id: 'n', rank: null }), th, ctx).score, -15);

  // Budget : au-dessus exclu, sans prix exclu
  const bud = { ...base, budget: 5 };
  assert.equal(scoreCommander(C({ id: 'p', eur: 4, rank: null }), bud, ctx).score, 15);
  assert.equal(scoreCommander(C({ id: 'p', eur: 6 }), bud, ctx), null);
  assert.equal(scoreCommander(C({ id: 'p', eur: null }), bud, ctx), null);

  // Puissance : détendu exclut les Game Changers
  assert.equal(scoreCommander(C({ id: 'g', game_changer: true }), { ...base, power: 'casual' }, ctx), null);
  const high = scoreCommander(C({ id: 'g', game_changer: true, rank: 1 }), { ...base, power: 'high' }, ctx);
  assert.equal(high.score, 20 + 10 + 10);
  assert.deepEqual(high.reasons, ['Game Changer', 'Parmi les plus joués']);

  // Origine
  assert.equal(scoreCommander(C({ id: 'x' }), { ...base, origin: 'owned' }, ctx), null);
  assert.equal(scoreCommander(C({ id: 'own' }), { ...base, origin: 'discover' }, ctx), null);
  const fresh = scoreCommander(C({ id: 'f', released_at: '2026-06-01', rank: null }), { ...base, origin: 'discover' }, ctx);
  assert.deepEqual(fresh, { score: 10, reasons: ['Sorti cette année'] });
});

test('matchmake : tri par score puis rang, limite', () => {
  const ctx = { owned: new Set(), theme: null, now: NOW };
  const list = [C({ id: 'a', rank: 1000 }), C({ id: 'b', rank: 1 }), C({ id: 'bg', pairing: 'background' })];
  const res = matchmake(list, EMPTY_ANSWERS, ctx, 5);
  assert.deepEqual(res.map((r) => r.commander.oracle_id), ['b', 'a']);
});

test('deckGroup + deckText', () => {
  assert.equal(deckGroup('Artifact Creature — Golem'), 'Créatures');
  assert.equal(deckGroup('Artifact Land'), 'Terrains');
  assert.equal(deckGroup('Land Creature — Forest Dryad'), 'Créatures');
  assert.equal(deckGroup('Legendary Enchantment Artifact'), 'Artefacts');
  assert.equal(deckGroup('Instant // Sorcery'), 'Éphémères');
  assert.equal(deckGroup(null), 'Autres');
  assert.equal(deckText('Atraxa', [{ name: 'Sol Ring', qty: 1 }, { name: 'Forest', qty: 8 }]), '1 Atraxa\n1 Sol Ring\n8 Forest');
});
