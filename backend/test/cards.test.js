import test from 'node:test';
import assert from 'node:assert/strict';

import { mapScryfallCard, toClientCard, dbCardToClient } from '../src/services/cards.js';

const RAW = {
  id: 'abc', oracle_id: 'o1', name: 'Lightning Bolt', set: 'm21', set_name: 'Core 2021',
  collector_number: '137', image_uris: { normal: 'n.png', small: 's.png' },
  colors: ['R'], color_identity: ['R'], type_line: 'Instant', oracle_text: 'deal 3',
  mana_cost: '{R}', cmc: 1, rarity: 'common', finishes: ['nonfoil', 'foil'],
  prices: { eur: '0.50', eur_foil: '1.20', usd: '0.60' },
};

test('mapScryfallCard : carte simple', () => {
  const m = mapScryfallCard(RAW);
  assert.equal(m.scryfall_id, 'abc');
  assert.equal(m.set_code, 'm21');
  assert.equal(m.cmc, 1);
  assert.equal(m.prices_eur, 0.5);
  assert.equal(m.prices_eur_foil, 1.2);
  assert.equal(m.image_uri, 'n.png');
  assert.equal(m.card_faces, null);
  assert.deepEqual(m.finishes, ['nonfoil', 'foil']);
});

test('mapScryfallCard : DFC (card_faces, image de la face avant)', () => {
  const dfc = {
    id: 'd1', name: 'A // B', set: 'znr', cmc: 3, rarity: 'rare', prices: {},
    card_faces: [
      { name: 'A', image_uris: { normal: 'na.png', small: 'sa.png' }, oracle_id: 'oa', type_line: 'Creature' },
      { name: 'B' },
    ],
  };
  const m = mapScryfallCard(dfc);
  assert.equal(m.image_uri, 'na.png');
  assert.equal(m.oracle_id, 'oa');
  assert.equal(m.cmc, 3);
  assert.ok(typeof m.card_faces === 'string' && m.card_faces.includes('"A"'));
});

test('toClientCard : forme client depuis Scryfall', () => {
  const t = toClientCard(RAW);
  assert.equal(t.scryfall_id, 'abc');
  assert.equal(t.set, 'm21');
  assert.equal(t.image, 'n.png');
  assert.equal(t.prices.eur, 0.5);
  assert.equal(t.prices.usd, 0.6);
});

test('dbCardToClient : forme client depuis une ligne DB', () => {
  const row = {
    scryfall_id: 'x', name: 'N', set_code: 'm21', set_name: 'Core', collector_number: '1',
    rarity: 'rare', image_uri: 'i', image_uri_small: 'is', type_line: 'Instant',
    oracle_text: 'o', mana_cost: '{R}', card_faces: null, colors: ['R'], finishes: ['nonfoil'],
    prices_eur: 1.5, prices_eur_foil: null, prices_eur_etched: null, prices_usd: 2, prices_usd_foil: null,
  };
  const d = dbCardToClient(row);
  assert.equal(d.set, 'm21');
  assert.equal(d.type_line, 'Instant');
  assert.equal(d.prices.eur, 1.5);
  assert.equal(d.prices.usd, 2);
});

test('mapScryfallCard : données Commander', () => {
  const m = mapScryfallCard({
    ...RAW, legalities: { commander: 'legal' }, edhrec_rank: 12, game_changer: true, keywords: ['Partner'],
  });
  assert.equal(m.legal_commander, true);
  assert.equal(m.edhrec_rank, 12);
  assert.equal(m.game_changer, true);
  assert.deepEqual(m.keywords, ['Partner']);
  const bare = mapScryfallCard({ ...RAW, legalities: { commander: 'banned' }, keywords: [] });
  assert.equal(bare.legal_commander, false);
  assert.equal(bare.game_changer, false);
  assert.equal(bare.keywords, null);
  assert.equal(bare.edhrec_rank, null);
});
