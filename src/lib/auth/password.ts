/**
 * Password hashing with Node's built-in scrypt (no native deps, works in the
 * standalone Docker image). Parameters are stored in the hash so they can be
 * raised later without invalidating existing passwords.
 * Format: scrypt$N$r$p$<salt b64>$<key b64>
 */
import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

const N = 1 << 15;
const R = 8;
const P = 1;
const KEY_LEN = 64;

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must exceed 128 * N * r (32 MiB at the defaults above).
    scrypt(password.normalize("NFKC"), salt, KEY_LEN, { ...opts, maxmem: 128 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  const parts = stored?.split("$");
  if (!parts || parts.length !== 6 || parts[0] !== "scrypt") {
    // Burn comparable time so a missing account isn't distinguishable by latency.
    await derive(password, randomBytes(16), { N, r: R, p: P });
    return false;
  }
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, "base64");
  const key = await derive(password, Buffer.from(saltB64, "base64"), { N: Number(n), r: Number(r), p: Number(p) });
  return key.length === expected.length && timingSafeEqual(key, expected);
}
