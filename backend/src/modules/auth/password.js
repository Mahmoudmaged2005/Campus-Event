import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  return salt + ':' + derivedKey.toString('hex');
}

export async function verifyPassword(password, storedHash) {
  const parts = storedHash.split(':');
  const salt = parts[0];
  const storedKey = Buffer.from(parts[1], 'hex');
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);
  if (storedKey.length !== derivedKey.length) {
    return false;
  }
  return crypto.timingSafeEqual(storedKey, derivedKey);
}
