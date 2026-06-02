import bcrypt from 'bcrypt';

const COST = 12;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const hashPassword = (password) => bcrypt.hash(password, COST);
export const comparePassword = (password, hash) => bcrypt.compare(password, hash);

/**
 * Règles spec §6.5 : email valide + mot de passe ≥ 8 car., 1 majuscule, 1 chiffre.
 * Retourne un tableau de messages d'erreur (vide = valide).
 */
export function validateCredentials(email, password) {
  const errors = [];
  if (!email || !EMAIL_RE.test(email)) errors.push('Email invalide');
  if (!password || password.length < 8) {
    errors.push('Mot de passe : 8 caractères minimum');
  } else {
    if (!/[A-Z]/.test(password)) errors.push('Mot de passe : au moins une majuscule');
    if (!/[0-9]/.test(password)) errors.push('Mot de passe : au moins un chiffre');
  }
  return errors;
}
