// HMAC-SHA256 signed URLs for the fs storage backend.
//
// AWS presigned URLs are an S3-native protocol — there is no filesystem
// equivalent. The fs backend issues download URLs that point at a route
// in apps/api (GET /api/storage/download/...). The route verifies the
// signature here, then streams the file from disk. Same TTL semantics as
// S3 presigning: a leaked URL becomes inert after `exp`.

import { createHmac, timingSafeEqual } from "node:crypto";

const ALGORITHM = "sha256";

export interface SignedParams {
  exp: number; // unix seconds
  sig: string; // base64url
}

export function signDownloadUrl(
  secret: string,
  key: string,
  ttlSeconds: number,
  now: number = Date.now(),
): SignedParams {
  const exp = Math.floor(now / 1000) + ttlSeconds;
  return { exp, sig: computeSig(secret, key, exp) };
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "expired" | "bad_signature" | "malformed" };

export function verifyDownloadUrl(
  secret: string,
  key: string,
  sig: string,
  exp: number,
  now: number = Date.now(),
): VerifyResult {
  if (!Number.isFinite(exp)) return { ok: false, reason: "malformed" };
  if (Math.floor(now / 1000) > exp) return { ok: false, reason: "expired" };

  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "base64url");
  } catch {
    return { ok: false, reason: "malformed" };
  }
  const expectedBuf = Buffer.from(computeSig(secret, key, exp), "base64url");

  // timingSafeEqual requires equal-length inputs — short-circuit on length
  // mismatch so a wrong-length signature doesn't throw.
  if (sigBuf.length !== expectedBuf.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(sigBuf, expectedBuf)) return { ok: false, reason: "bad_signature" };
  return { ok: true };
}

function computeSig(secret: string, key: string, exp: number): string {
  // The signed payload is `key\nexp`. The newline separator makes
  // ambiguity impossible: there is no key value that, combined with one
  // exp, produces the same byte string as a different key + exp pair.
  return createHmac(ALGORITHM, secret).update(`${key}\n${exp}`).digest("base64url");
}
