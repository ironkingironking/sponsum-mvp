import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  });

  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export function verifyPassword(password: string, encoded: string): boolean {
  if (!encoded?.startsWith("scrypt$")) {
    return false;
  }

  const parts = encoded.split("$");

  if (parts.length !== 6) {
    return false;
  }

  const [, nStr, rStr, pStr, saltHex, keyHex] = parts;

  const N = Number(nStr);
  const r = Number(rStr);
  const p = Number(pStr);

  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const stored = Buffer.from(keyHex, "hex");

  const derived = scryptSync(password, salt, stored.length, { N, r, p });

  if (derived.length !== stored.length) {
    return false;
  }

  return timingSafeEqual(derived, stored);
}
