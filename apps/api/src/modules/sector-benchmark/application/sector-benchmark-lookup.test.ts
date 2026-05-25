import { describe, expect, it } from "vitest";
import { InMemorySectorBenchmarkLookup } from "../infrastructure/in-memory-sector-benchmark-lookup.js";
import { isInsufficientData } from "../domain/types.js";

function aggregateFor(input: { cae3: string; year: number; dimensao?: "pequena" }) {
  return {
    cae3: input.cae3,
    dimensao: input.dimensao ?? ("pequena" as const),
    year: input.year,
    vintageYear: input.year + 2,
    fonte: "placeholder_v1",
    nCompanies: 180,
    medianTurnover: 2_500_000,
    medianEbitdaMargin: 0.18,
    p25Turnover: null,
    p75Turnover: null,
  };
}

describe("SectorBenchmarkLookup", () => {
  it("happy path — exact year match returns the aggregate", async () => {
    const lookup = new InMemorySectorBenchmarkLookup();
    lookup.seed([aggregateFor({ cae3: "620", year: 2023 })]);

    const result = await lookup.lookup({ cae3: "620", dimensao: "pequena", year: 2023 });
    if (isInsufficientData(result)) throw new Error("expected aggregate");
    expect(result.medianTurnover).toBe(2_500_000);
    expect(result.year).toBe(2023);
  });

  it("year fallback — exact year missing, prior year present", async () => {
    const lookup = new InMemorySectorBenchmarkLookup();
    lookup.seed([aggregateFor({ cae3: "620", year: 2022 })]);

    const result = await lookup.lookup({ cae3: "620", dimensao: "pequena", year: 2023 });
    if (isInsufficientData(result)) throw new Error("expected fallback hit");
    expect(result.year).toBe(2022);
  });

  it("year fallback — both years missing within window → InsufficientData", async () => {
    const lookup = new InMemorySectorBenchmarkLookup();
    // Seed an old row outside the 3-year window from year=2025.
    lookup.seed([aggregateFor({ cae3: "620", year: 2020 })]);

    const result = await lookup.lookup({ cae3: "620", dimensao: "pequena", year: 2025 });
    expect(isInsufficientData(result)).toBe(true);
    if (!isInsufficientData(result)) return;
    expect(result.reason).toBe("no_aggregate_in_year_window");
  });

  it("dimensao mismatch — no row for that slice → InsufficientData", async () => {
    const lookup = new InMemorySectorBenchmarkLookup();
    lookup.seed([aggregateFor({ cae3: "620", year: 2023, dimensao: "pequena" })]);

    const result = await lookup.lookup({ cae3: "620", dimensao: "grande", year: 2023 });
    expect(isInsufficientData(result)).toBe(true);
    if (!isInsufficientData(result)) return;
    expect(result.reason).toBe("no_aggregate_in_year_window");
  });

  it("cae3 missing → distinct InsufficientData reason 'missing_cae'", async () => {
    const lookup = new InMemorySectorBenchmarkLookup();
    const result = await lookup.lookup({ cae3: null, dimensao: "pequena", year: 2023 });
    expect(isInsufficientData(result)).toBe(true);
    if (!isInsufficientData(result)) return;
    expect(result.reason).toBe("missing_cae");
  });

  it("dimensao missing → distinct InsufficientData reason 'missing_dimensao'", async () => {
    const lookup = new InMemorySectorBenchmarkLookup();
    const result = await lookup.lookup({ cae3: "620", dimensao: null, year: 2023 });
    expect(isInsufficientData(result)).toBe(true);
    if (!isInsufficientData(result)) return;
    expect(result.reason).toBe("missing_dimensao");
  });

  it("multiple candidates in window — returns the newest year", async () => {
    const lookup = new InMemorySectorBenchmarkLookup();
    lookup.seed([
      aggregateFor({ cae3: "620", year: 2022 }),
      aggregateFor({ cae3: "620", year: 2023 }),
    ]);
    const result = await lookup.lookup({ cae3: "620", dimensao: "pequena", year: 2023 });
    if (isInsufficientData(result)) throw new Error("expected aggregate");
    expect(result.year).toBe(2023);
  });
});
