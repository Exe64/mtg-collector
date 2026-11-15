import test from 'node:test';
import assert from 'node:assert/strict';

import { redis } from '../src/config/redis.js';
import { parseDeckText, frontKey } from '../src/services/deckCheck.js';
import { legalityIssues } from '../src/services/decks.js';

test.after(() => redis.disconnect());

test('parseDeckText : sections Commander, Sideboard, Maybeboard, Tokens', () => {
  const list = parseDeckText([
    'Commander', '1 Atraxa, Praetors\' Voice (2X2) 190',
    '', 'Deck', '1 Sol Ring', '2x Fire // Ice *F*',
    'SIDEBOARD:', '1 Pyroblast',
    '// Maybeboard', '1 Rhystic Study',
    'Tokens', '1 Treasure',
  ].join('\n'));
  assert.deepEqual(list, [
    { name: 'Atraxa, Praetors\' Voice', quantity: 1, zone: 'commander' },
    { name: 'Sol Ring', quantity: 1, zone: 'main' },
    { name: 'Fire // Ice', quantity: 2, zone: 'main' },
    { name: 'Pyroblast', quantity: 1, zone: 'side' },
    { name: 'Rhystic Study', quantity: 1, zone: 'maybe' },
  ]);
  // Sans en-tête : tout en principal ; commentaires ignorés
  assert.deepEqual(parseDeckText('// mon deck\n4 Lightning Bolt'), [{ name: 'Lightning Bolt', quantity: 4, zone: 'main' }]);
});

test('frontKey : faces séparées par « // » ou « / »', () => {
  assert.equal(frontKey('Etali, Primal Conqueror / Etali, Primal Sickness'), 'etali, primal conqueror');
  assert.equal(frontKey('Fire // Ice'), 'fire');
  assert.equal(frontKey('Fire//Ice'), 'fire');
  assert.equal(frontKey(' Sol Ring '), 'sol ring');
});

const line = (name, o = {}) => ({
  name, zone: 'main', qty: 1, color_identity: [], type_line: 'Instant', oracle_text: '',
  legalities: { commander: 'legal', modern: 'legal', vintage: 'legal' }, ...o,
});

test('legalityIssues : Commander (taille, singleton, identité, commandant)', () => {
  const cmd = line('Krenko, Mob Boss', { zone: 'commander', color_identity: ['R'], type_line: 'Legendary Creature — Goblin' });
  const filler = Array.from({ length: 95 }, (_, i) => line(`Card ${i}`));
  const deck = [
    cmd, ...filler,
    line('Mountain', { qty: 2, type_line: 'Basic Land — Mountain' }),
    line('Relentless Rats', { qty: 2, oracle_text: 'A deck can have any number of cards named Relentless Rats.' }),
  ];
  assert.deepEqual(legalityIssues('commander', deck), []);

  const bad = [
    { ...cmd },
    ...filler,
    line('Sol Ring', { qty: 2 }),
    line('Counterspell', { color_identity: ['U'] }),
    line('Mana Crypt', { legalities: { commander: 'banned' } }),
    line('Maybe Card', { zone: 'maybe', legalities: { commander: 'not_legal' } }),
  ];
  const msgs = Object.fromEntries(legalityIssues('commander', bad).map((i) => [i.message, i.cards]));
  assert.deepEqual(msgs['Cartes bannies dans ce format'], ['Mana Crypt']);
  assert.deepEqual(msgs['Exemplaire unique : cartes en plusieurs exemplaires'], ['Sol Ring']);
  assert.deepEqual(msgs["Hors de l'identité couleur du commandant"], ['Counterspell']);
  assert.ok(!Object.keys(msgs).some((m) => /sur 100/.test(m))); // 100 cartes, « peut-être » exclu
  const small = legalityIssues('commander', [cmd, ...filler]);
  assert.deepEqual(small.map((i) => [i.level, i.message]), [['warn', '96 cartes sur 100']]);
  const big = legalityIssues('commander', [cmd, ...filler, line('Plains', { qty: 10, type_line: 'Basic Land' })]);
  assert.ok(big.some((i) => i.level === 'error' && i.message === '106 cartes sur 100'));

  const noCmd = legalityIssues('commander', [line('Sol Ring', { zone: 'commander', type_line: 'Artifact' })]);
  assert.ok(noCmd.some((i) => i.message === 'Ne peut pas être commandant'));
  assert.ok(legalityIssues('commander', []).some((i) => i.message === 'Aucun commandant désigné'));
  // Duel Commander : mêmes règles de construction
  assert.ok(legalityIssues('duel', [cmd, ...filler]).some((i) => i.message === '96 cartes sur 100'));
});

test('legalityIssues : autres formats, restreintes, légalité inconnue, casual', () => {
  const deck = [
    line('Black Lotus', { legalities: { vintage: 'restricted' } }),
    line('Black Lotus', { zone: 'side', legalities: { vintage: 'restricted' } }),
    line('Unsynced', { legalities: null }),
  ];
  const v = legalityIssues('vintage', deck);
  assert.deepEqual(v.find((i) => i.level === 'error').cards, ['Black Lotus']);
  assert.ok(v.some((i) => i.level === 'warn' && /inconnue pour 1/.test(i.message)));
  // Pas de règle Commander hors Commander
  assert.ok(!v.some((i) => /sur 100|commandant/.test(i.message)));
  assert.deepEqual(legalityIssues('modern', [line('Bolt')]), []);
  assert.deepEqual(legalityIssues('casual', deck), []);
});
