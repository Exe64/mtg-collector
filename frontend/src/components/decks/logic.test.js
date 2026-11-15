import test from 'node:test';
import assert from 'node:assert/strict';

import { deckStats, savedDeckText, groupByType, formatLabel } from './logic.js';

const card = (name, o = {}) => ({ name, zone: 'main', qty: 1, cmc: 2, colors: ['R'], type_line: 'Instant', ...o });

test('deckStats : courbe hors terrains et peut-être, couleurs, types', () => {
  const s = deckStats([
    card('Krenko', { zone: 'commander', cmc: 4, type_line: 'Legendary Creature — Goblin' }),
    card('Bolt', { qty: 4, cmc: 1 }),
    card('Emrakul', { cmc: 15, colors: [], type_line: 'Creature — Eldrazi' }),
    card('Mountain', { qty: 30, cmc: 0, colors: [], type_line: 'Basic Land — Mountain' }),
    card('Maybe', { zone: 'maybe', cmc: 3 }),
    card('Side', { zone: 'side', cmc: 3 }),
  ]);
  assert.deepEqual(s.curve, [0, 4, 0, 0, 1, 0, 0, 1]);
  assert.deepEqual(s.colors, { W: 0, U: 0, B: 0, R: 5, G: 0, C: 1 });
  assert.deepEqual(s.types, [['Créatures', 2], ['Terrains', 30], ['Éphémères', 4]]);
});

test('savedDeckText : sections dans l\'ordre, zones vides omises', () => {
  const text = savedDeckText([card('Sol Ring'), card('Krenko', { zone: 'commander' }), card('Pyro', { zone: 'side', qty: 2 })]);
  assert.equal(text, 'Commander\n1 Krenko\n\nDeck\n1 Sol Ring\n\nSideboard\n2 Pyro');
});

test('savedDeckText : édition, numéro et finition', () => {
  const text = savedDeckText([
    card('Lightning Bolt', { set_code: 'pf19', collector_number: '1', finish: 'foil' }),
    card('Sol Ring', { set_code: 'cmr', collector_number: '472', finish: 'nonfoil' }),
  ]);
  assert.equal(text, 'Deck\n1 Lightning Bolt (PF19) 1 *F*\n1 Sol Ring (CMR) 472');
});

test('groupByType et formatLabel', () => {
  assert.deepEqual(groupByType([card('B'), card('A')]).map(([g, l]) => [g, l.map((c) => c.name)]), [['Éphémères', ['A', 'B']]]);
  assert.equal(formatLabel('paupercommander'), 'Pauper Commander');
  assert.equal(formatLabel('inconnu'), 'inconnu');
});
