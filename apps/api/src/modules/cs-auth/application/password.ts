import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

// Node's scrypt is in stdlib; no native build required. Parameters match
// the defaults recommended for password storage in 2024+. Tweak only with
// a migration that re-hashes existing users.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SALT_BYTES = 16;
const KEY_BYTES = 64;

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

// Format: scrypt$N=16384,r=8,p=1$<saltHex>$<hashHex>
// Keeping parameters embedded means later tuning stays decodable.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
  });
  return `scrypt$N=${SCRYPT_N},r=${SCRYPT_R},p=${SCRYPT_P}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const params: Record<string, number> = {};
  for (const kv of (parts[1] ?? "").split(",")) {
    const [k, v] = kv.split("=");
    if (k && v !== undefined) params[k] = Number(v);
  }
  const N = params.N;
  const r = params.r;
  const p = params.p;
  if (
    !Number.isFinite(N) ||
    !Number.isFinite(r) ||
    !Number.isFinite(p) ||
    N === undefined ||
    r === undefined ||
    p === undefined
  ) {
    return false;
  }
  const salt = Buffer.from(parts[2] ?? "", "hex");
  const expected = Buffer.from(parts[3] ?? "", "hex");
  if (salt.length === 0 || expected.length === 0) return false;
  const actual = await scrypt(password, salt, expected.length, { N, r, p });
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}
