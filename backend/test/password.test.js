import test from 'node:test';
import assert from 'node:assert/strict';

import { validateCredentials } from '../src/utils/password.js';

test('identifiants valides → aucune erreur', () => {
  assert.deepEqual(validateCredentials('user@example.com', 'Password1'), []);
});

test('mot de passe trop court', () => {
  assert.ok(validateCredentials('user@example.com', 'Pw1').length > 0);
});

test('mot de passe sans majuscule', () => {
  assert.ok(validateCredentials('user@example.com', 'password1').some((e) => /majuscule/.test(e)));
});

test('mot de passe sans chiffre', () => {
  assert.ok(validateCredentials('user@example.com', 'Passwordxx').some((e) => /chiffre/.test(e)));
});

test('email invalide', () => {
  assert.ok(validateCredentials('pas-un-email', 'Password1').some((e) => /Email/.test(e)));
});
