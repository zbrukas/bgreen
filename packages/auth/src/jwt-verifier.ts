import { type JWTPayload, createRemoteJWKSet, jwtVerify } from "jose";

export interface WorkosJwtClaims extends JWTPayload {
  sub: string;
  org_id?: string;
  permissions?: string[];
  roles?: string[];
}

export interface WorkosJwtVerifier {
  verify(token: string): Promise<WorkosJwtClaims | null>;
}

/**
 * Verifies WorkOS access tokens against the live JWKS endpoint.
 *
 * Returns `null` for any failure (empty input, malformed token, expired,
 * signature mismatch). Callers should treat null as 401.
 */
export class JoseWorkosJwtVerifier implements WorkosJwtVerifier {
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;

  constructor(clientId: string) {
    if (!clientId) {
      throw new Error("JoseWorkosJwtVerifier: clientId is required");
    }
    this.jwks = createRemoteJWKSet(new URL(`https://api.workos.com/sso/jwks/${clientId}`));
  }

  async verify(token: string): Promise<WorkosJwtClaims | null> {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, this.jwks);
      if (!payload.sub) return null;
      return payload as WorkosJwtClaims;
    } catch {
      return null;
    }
  }
}
