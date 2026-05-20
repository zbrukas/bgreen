import { describe, expect, it } from "vitest";
import { validateNif } from "./nif";

describe("validateNif", () => {
  // Valid NIFs constructed against the mod-11 spec. Prefix digit varies to
  // exercise each entity-type bucket.
  it("accepts a valid NIF starting with 1 (singular)", () => {
    expect(validateNif("100000002")).toEqual({ valid: true, normalized: "100000002" });
  });

  it("accepts a valid NIF starting with 2", () => {
    expect(validateNif("200000004")).toEqual({ valid: true, normalized: "200000004" });
  });

  it("accepts a valid NIF starting with 5 (legal entity)", () => {
    // 5×9 = 45; 45 mod 11 = 1 → check digit = 0.
    expect(validateNif("500000000")).toEqual({ valid: true, normalized: "500000000" });
  });

  it("accepts a valid NIF starting with 9", () => {
    // 9×9 = 81; 81 mod 11 = 4 → check digit = 7.
    expect(validateNif("900000007")).toEqual({ valid: true, normalized: "900000007" });
  });

  it("strips surrounding whitespace before validating", () => {
    expect(validateNif("  500000000  ")).toEqual({
      valid: true,
      normalized: "500000000",
    });
  });

  it("rejects an empty string", () => {
    expect(validateNif("")).toEqual({ valid: false, reason: "empty" });
  });

  it("rejects null / undefined input", () => {
    expect(validateNif(null)).toEqual({ valid: false, reason: "empty" });
    expect(validateNif(undefined)).toEqual({ valid: false, reason: "empty" });
  });

  it("rejects whitespace-only input as empty", () => {
    expect(validateNif("   ")).toEqual({ valid: false, reason: "empty" });
  });

  it("rejects non-numeric characters", () => {
    expect(validateNif("12345678A")).toEqual({ valid: false, reason: "non_numeric" });
    expect(validateNif("123-456-78")).toEqual({ valid: false, reason: "non_numeric" });
  });

  it("rejects strings shorter or longer than 9 digits", () => {
    expect(validateNif("12345678")).toEqual({ valid: false, reason: "wrong_length" });
    expect(validateNif("1234567890")).toEqual({ valid: false, reason: "wrong_length" });
  });

  it("rejects a 9-digit number with a wrong check digit", () => {
    // 500000001 — same body as the valid 500000000 but wrong check digit.
    expect(validateNif("500000001")).toEqual({ valid: false, reason: "bad_checksum" });
  });
});
