import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeRow } from '../src/services/importer.js';

test('ligne Moxfield standard', () => {
  const r = normalizeRow({
    Count: '4', Name: 'Sol Ring', Edition: 'CMR', Condition: 'NM',
    Language: 'English', Foil: '', 'Collector Number': '469', 'Purchase Price': '',
  });
  assert.equal(r.quantity, 4);
  assert.equal(r.name, 'Sol Ring');
  assert.equal(r.set, 'CMR');
  assert.equal(r.condition, 'NM');
  assert.equal(r.language, 'en');
  assert.equal(r.finish, 'nonfoil');
  assert.equal(r.collector_number, '469');
  assert.equal(r.acquired_price, null);
});

test('foil + condition HP → PO, langue FR, prix', () => {
  const r = normalizeRow({
    Count: '1', Name: 'Black Lotus', Edition: 'LEA', Condition: 'HP',
    Language: 'French', Foil: 'foil', 'Purchase Price': '800.00',
  });
  assert.equal(r.finish, 'foil');
  assert.equal(r.condition, 'PO');
  assert.equal(r.language, 'fr');
  assert.equal(r.acquired_price, 800);
});

test('format générique name + quantity', () => {
  const r = normalizeRow({ name: 'Llanowar Elves', quantity: '2' });
  assert.equal(r.quantity, 2);
  assert.equal(r.name, 'Llanowar Elves');
  assert.equal(r.condition, 'NM');
  assert.equal(r.finish, 'nonfoil');
});

test('condition Mint → MT, etched', () => {
  const r = normalizeRow({ Name: 'X', Count: '1', Condition: 'M', Foil: 'etched' });
  assert.equal(r.condition, 'MT');
  assert.equal(r.finish, 'etched');
});
