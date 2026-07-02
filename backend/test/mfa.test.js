import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generateSecret, verifyTotp, generateBackupCodes, consumeBackupCode,
} from '../src/services/mfa.js';
import { generate as otpGenerate } from 'otplib';

test('TOTP : code généré vérifié, mauvais code rejeté', async () => {
  const secret = generateSecret();
  const token = await otpGenerate({ secret });
  assert.equal(await verifyTotp(secret, token), true);
  assert.equal(await verifyTotp(secret, '000000'), false);
  assert.equal(await verifyTotp(secret, ''), false);
});

test('codes de secours : usage unique, insensible à la casse', () => {
  const { plain, hashes } = generateBackupCodes();
  assert.equal(plain.length, 10);
  assert.equal(hashes.length, 10);

  // un code valide (en majuscules) est consommé → liste amputée d'un élément
  const remaining = consumeBackupCode(hashes, plain[0].toUpperCase());
  assert.equal(remaining.length, 9);
  // le même code ne repasse plus
  assert.equal(consumeBackupCode(remaining, plain[0]), null);
  // un code inconnu est refusé
  assert.equal(consumeBackupCode(hashes, 'zzzz-zzzz'), null);
});
