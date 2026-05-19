import { describe, expect, it } from "vitest";
import { JoseWorkosJwtVerifier } from "./jwt-verifier";

describe("JoseWorkosJwtVerifier", () => {
  it("throws when clientId is empty", () => {
    expect(() => new JoseWorkosJwtVerifier("")).toThrow(/clientId is required/);
  });

  it("constructs successfully with a non-empty clientId", () => {
    expect(() => new JoseWorkosJwtVerifier("client_test")).not.toThrow();
  });

  it("returns null for an empty token (skipping JWKS lookup)", async () => {
    const verifier = new JoseWorkosJwtVerifier("client_test");
    await expect(verifier.verify("")).resolves.toBeNull();
  });

  it("returns null for a syntactically malformed token", async () => {
    const verifier = new JoseWorkosJwtVerifier("client_test");
    await expect(verifier.verify("not-a-jwt")).resolves.toBeNull();
  });
});
