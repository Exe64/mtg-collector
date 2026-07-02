import { createHash, randomBytes, webcrypto } from 'node:crypto';

// Node 18 : otplib v13 (noble) requiert globalThis.crypto (natif à partir de Node 20).
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const { generateSecret: otpSecret, generateURI, verify: otpVerify } = await import('otplib');

const ISSUER = 'MTG Collection Manager';

export const generateSecret = () => otpSecret();

export const otpauthUri = (email, secret) =>
  generateURI({ secret, label: email, issuer: ISSUER });

/** Vérifie un code TOTP (±1 pas de 30 s pour la dérive d'horloge). */
export async function verifyTotp(secret, token) {
  if (!secret || !token) return false;
  const { valid } = await otpVerify({ token: String(token).replace(/\s/g, ''), secret, window: 1 });
  return valid === true;
}

// --- Codes de secours (usage unique) ---
// Codes à haute entropie → SHA-256 suffit (pas besoin de bcrypt, réservé aux mots de passe).
const hashCode = (code) => createHash('sha256').update(code).digest('hex');

/** 10 codes lisibles (ex. "a1b2-c3d4"). Renvoie { plain[], hashes[] }. */
export function generateBackupCodes(n = 10) {
  const plain = [];
  const hashes = [];
  for (let i = 0; i < n; i += 1) {
    const raw = randomBytes(4).toString('hex'); // 8 hex
    const code = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    plain.push(code);
    hashes.push(hashCode(code));
  }
  return { plain, hashes };
}

/**
 * Cherche un code de secours dans la liste de hashs. Si trouvé, renvoie la liste
 * amputée du hash consommé (usage unique) ; sinon renvoie null.
 */
export function consumeBackupCode(hashes, code) {
  const h = hashCode(String(code).trim().toLowerCase());
  if (!hashes.includes(h)) return null;
  return hashes.filter((x) => x !== h);
}
