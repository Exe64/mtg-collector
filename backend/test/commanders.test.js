import test from 'node:test';
import assert from 'node:assert/strict';

import { redis } from '../src/config/redis.js';
import { pairingOf, coverage } from '../src/services/commanders.js';
import { edhrecSlug } from '../src/services/edhrec.js';

// commanders.js importe le cache Redis : on coupe la connexion pour laisser sortir le process.
test.after(() => redis.disconnect());

test('pairingOf : mots-clés Scryfall et repli sur le texte', () => {
  const p = (type_line, oracle_text, keywords) => pairingOf({ type_line, oracle_text, keywords });
  assert.equal(p('Legendary Enchantment — Background', 'Commander creatures you own have…'), 'background');
  assert.equal(p('Legendary Creature — Human', 'Partner with Pir\nFlying', ['Partner with']), 'partner_with');
  assert.equal(p('Legendary Creature — Human', 'Partner (You can have two commanders…)', ['Partner']), 'partner');
  assert.equal(p('Legendary Creature — Elf', 'Partner—Survivors'), 'partner');
  assert.equal(p('Legendary Creature — Human', 'Choose a Background (You can have…)'), 'choose_background');
  assert.equal(p('Legendary Creature — Human', 'Friends forever'), 'friends_forever');
  assert.equal(p('Legendary Creature — Human', "Doctor's companion"), 'doctors_companion');
  assert.equal(p('Legendary Creature — Time Lord Doctor', 'Whenever…'), 'doctor');
  assert.equal(p('Legendary Creature — Angel', 'Flying, vigilance', ['Flying']), null);
  // « partner » au milieu d'une phrase n'est pas un appariement
  assert.equal(p('Legendary Creature — Human', 'Target partner gains haste'), null);
});

test('coverage : % possédé hors terrains de base et coût des manquantes', () => {
  const deck = [['Sol Ring', 1], ['Forest', 10], ['Fire // Ice', 1], ['Rhystic Study', 1], ['Smothering Tithe', 1]];
  const owned = new Set(['sol ring', 'fire']);
  const prices = new Map([['rhystic study', { eur: 30 }], ['smothering tithe', { eur: 12.5 }]]);
  const c = coverage(deck, owned, prices);
  assert.equal(c.total, 4);
  assert.equal(c.owned, 2);
  assert.equal(c.pct, 50);
  assert.deepEqual(c.missing.map((m) => m.name), ['Rhystic Study', 'Smothering Tithe']);
  assert.equal(c.missingEur, 42.5);
  assert.equal(coverage([], owned, prices).pct, 0);
});

test('edhrecSlug : ponctuation, accents, faces', () => {
  assert.equal(edhrecSlug("Atraxa, Praetors' Voice"), 'atraxa-praetors-voice');
  assert.equal(edhrecSlug('Lim-Dûl the Necromancer'), 'lim-dul-the-necromancer');
  assert.equal(edhrecSlug("Y'shtola, Night's Blessed"), 'yshtola-nights-blessed');
  assert.equal(edhrecSlug('Esika, God of the Tree // The Prismatic Bridge'), 'esika-god-of-the-tree');
});
