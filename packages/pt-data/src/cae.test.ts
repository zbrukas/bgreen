import { describe, expect, it, vi } from "vitest";
import type { CaeEntry } from "./cae";

// Synthetic catalog mirroring INE shape for deterministic tests.
const synthetic: CaeEntry[] = [
  { code: "35111", description: "Produção de eletricidade" },
  { code: "35112", description: "Transporte de eletricidade" },
  { code: "35120", description: "Distribuição de eletricidade" },
  { code: "01111", description: "Cerealicultura (exceto arroz)" },
  { code: "47210", description: "Comércio a retalho de frutas e produtos hortícolas" },
];

vi.mock("./cae-data.json", () => ({ default: synthetic }));

const { findCaeByCode, searchCae } = await import("./cae");

describe("findCaeByCode", () => {
  it("returns the entry for an exact code match", () => {
    expect(findCaeByCode("35111")).toEqual({
      code: "35111",
      description: "Produção de eletricidade",
    });
  });

  it("returns null when the code is not in the catalog", () => {
    expect(findCaeByCode("99999")).toBeNull();
  });

  it("trims whitespace before lookup", () => {
    expect(findCaeByCode("  35120  ")).not.toBeNull();
  });
});

describe("searchCae", () => {
  it("returns code-prefix matches first", () => {
    const results = searchCae("351");
    expect(results.map((r) => r.code)).toEqual(["35111", "35112", "35120"]);
  });

  it("matches description substring when no code prefix matches", () => {
    const results = searchCae("Cerealicultura");
    expect(results).toHaveLength(1);
    expect(results[0]?.code).toBe("01111");
  });

  it("is diacritic-insensitive on description search", () => {
    const results = searchCae("eletricidade");
    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it("returns an empty list for an empty query", () => {
    expect(searchCae("")).toEqual([]);
    expect(searchCae("   ")).toEqual([]);
  });

  it("respects the limit parameter", () => {
    const results = searchCae("35", 2);
    expect(results).toHaveLength(2);
  });
});
