import { createHmac, timingSafeEqual } from "node:crypto";

// HMAC-signed session tokens for CS users. Stateless: the API never
// stores a session row — the token itself is the proof. Format:
//   cs.<base64url(JSON.stringify({ sub, iat, exp }))>.<base64url(hmacSha256)>
// The `cs.` prefix lets the auth middleware fast-path between WorkOS
// JWTs (which start with three dot-separated base64 segments) and CS
// sessions without speculative parsing.

const PREFIX = "cs.";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret(): Buffer {
  const raw = process.env.CS_SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "CS_SESSION_SECRET must be set (>=32 chars) before issuing or verifying CS sessions",
    );
  }
  return Buffer.from(raw);
}

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): Buffer {
  const pad = s.length % 4 === 0 ? 0 : 4 - (s.length % 4);
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad), "base64");
}

export interface CsSessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

export function mintCsSession(userId: string, ttlSeconds = DEFAULT_TTL_SECONDS): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: CsSessionPayload = { sub: userId, iat: now, exp: now + ttlSeconds };
  const payloadBuf = Buffer.from(JSON.stringify(payload));
  const payloadB64 = base64url(payloadBuf);
  const sig = createHmac("sha256", secret()).update(payloadB64).digest();
  return `${PREFIX}${payloadB64}.${base64url(sig)}`;
}

export type VerifyResult =
  | { ok: true; payload: CsSessionPayload }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function looksLikeCsSession(token: string): boolean {
  return token.startsWith(PREFIX);
}

export function verifyCsSession(token: string): VerifyResult {
  if (!looksLikeCsSession(token)) return { ok: false, reason: "malformed" };
  const body = token.slice(PREFIX.length);
  const dot = body.indexOf(".");
  if (dot < 0) return { ok: false, reason: "malformed" };
  const payloadB64 = body.slice(0, dot);
  const sigB64 = body.slice(dot + 1);
  if (!payloadB64 || !sigB64) return { ok: false, reason: "malformed" };

  const expectedSig = createHmac("sha256", secret()).update(payloadB64).digest();
  const providedSig = fromBase64url(sigB64);
  if (providedSig.length !== expectedSig.length) return { ok: false, reason: "bad_signature" };
  if (!timingSafeEqual(providedSig, expectedSig)) return { ok: false, reason: "bad_signature" };

  let payload: CsSessionPayload;
  try {
    payload = JSON.parse(fromBase64url(payloadB64).toString("utf8")) as CsSessionPayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (typeof payload.sub !== "string" || typeof payload.exp !== "number") {
    return { ok: false, reason: "malformed" };
  }
  if (Math.floor(Date.now() / 1000) >= payload.exp) return { ok: false, reason: "expired" };
  return { ok: true, payload };
}
