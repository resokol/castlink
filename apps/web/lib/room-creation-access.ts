import { createHash, timingSafeEqual } from 'node:crypto';

const digest = (password: string) => createHash('sha256').update(password, 'utf8').digest();

function configuredDigest() {
  const hash = process.env.ROOM_CREATION_PASSWORD_SHA256;
  // A configured malformed hash must never fall back to the plaintext option.
  if (hash !== undefined && hash !== '') return /^[a-f0-9]{64}$/i.test(hash) ? Buffer.from(hash, 'hex') : undefined;
  const password = process.env.ROOM_CREATION_PASSWORD;
  return typeof password === 'string' && password.trim().length > 0 && password.length <= 256 ? digest(password) : undefined;
}

/** Public creation has its own server credential; existing room logins do not use it. */
export function roomCreationEnabled() {
  return !!configuredDigest();
}

export function validRoomCreationPassword(value: unknown) {
  const expected = configuredDigest();
  if (!expected || typeof value !== 'string' || !value || value.length > 256) return false;
  return timingSafeEqual(digest(value), expected);
}
