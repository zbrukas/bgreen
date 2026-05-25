// V11.1 — InputDataHasher unit tests.
//
// Covers the deep-module spec from V11: ordering invariance, number
// serialisation, nested objects, plus the date + reject-non-finite +
// undefined-drop rules called out in the implementation comments.

import { describe, expect, it } from "vitest";
import {
  InputDataHashError,
  canonicalize,
  hashInputData,
} from "./input-data-hasher.js";

describe("hashInputData — determinism", () => {
  it("same object hashes to the same digest across runs", () => {
    const a = hashInputData({ a: 1, b: 2 });
    const b = hashInputData({ a: 1, b: 2 });
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("key-order in the source object doesn't affect the digest", () => {
    const x = hashInputData({ a: 1, b: 2, c: 3 });
    const y = hashInputData({ c: 3, a: 1, b: 2 });
    expect(x).toBe(y);
  });

  it("nested objects: child keys sort independently of parent order", () => {
    const x = hashInputData({ outer: { z: 1, a: 2 }, top: true });
    const y = hashInputData({ top: true, outer: { a: 2, z: 1 } });
    expect(x).toBe(y);
  });
});

describe("hashInputData — array order is preserved", () => {
  it("array reorder changes the digest (positional semantics)", () => {
    const a = hashInputData([1, 2, 3]);
    const b = hashInputData([3, 2, 1]);
    expect(a).not.toBe(b);
  });
});

describe("hashInputData — number serialisation", () => {
  it("integer vs float with same value: same digest", () => {
    // JSON serialises 1 and 1.0 identically; the canonicaliser
    // shouldn't introduce a distinction.
    const a = hashInputData({ x: 1 });
    const b = hashInputData({ x: 1.0 });
    expect(a).toBe(b);
  });

  it("rejects non-finite numbers (NaN, ±Infinity)", () => {
    expect(() => hashInputData({ x: Number.NaN })).toThrow(InputDataHashError);
    expect(() => hashInputData({ x: Number.POSITIVE_INFINITY })).toThrow(InputDataHashError);
    expect(() => hashInputData({ x: Number.NEGATIVE_INFINITY })).toThrow(InputDataHashError);
  });
});

describe("hashInputData — undefined + null", () => {
  it("undefined values are dropped (matches JSON.stringify)", () => {
    const withUndef = hashInputData({ a: 1, b: undefined });
    const withoutKey = hashInputData({ a: 1 });
    expect(withUndef).toBe(withoutKey);
  });

  it("null values are preserved (distinct from absent)", () => {
    const withNull = hashInputData({ a: 1, b: null });
    const withoutKey = hashInputData({ a: 1 });
    expect(withNull).not.toBe(withoutKey);
  });
});

describe("hashInputData — dates", () => {
  it("Date objects normalised to ISO string before hashing", () => {
    const d = new Date("2026-05-25T12:00:00Z");
    const a = hashInputData({ when: d });
    const b = hashInputData({ when: "2026-05-25T12:00:00.000Z" });
    expect(a).toBe(b);
  });
});

describe("canonicalize — canonical form is observable", () => {
  it("emits keys in lexicographic order at every depth", () => {
    const c = canonicalize({ b: { z: 1, a: 2 }, a: 1 });
    expect(c).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it("hash matches a known SHA-256 for a known canonical input", () => {
    // {"a":1,"b":2} → SHA-256 hex (computed offline; locks the
    // canonicalisation+hash combo against accidental drift).
    expect(hashInputData({ b: 2, a: 1 })).toBe(
      "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
    );
  });
});
