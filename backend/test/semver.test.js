import test from 'node:test';
import assert from 'node:assert/strict';
import { parseVersion, compareVersions } from '../src/utils/semver.js';

test('parseVersion : préfixe v, suffixe ignoré, invalide → null', () => {
  assert.deepEqual(parseVersion('v1.2.3'), [1, 2, 3]);
  assert.deepEqual(parseVersion('10.0.1-rc.1'), [10, 0, 1]);
  assert.equal(parseVersion('dev'), null);
  assert.equal(parseVersion(undefined), null);
});

test('compareVersions : ordre numérique, pas lexical', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('v1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('1.0.0', '2.0.0'), -1);
  assert.equal(compareVersions('1.2.10', '1.2.9'), 1);
  assert.throws(() => compareVersions('1.0.0', 'main'), /invalid version: main/);
});
