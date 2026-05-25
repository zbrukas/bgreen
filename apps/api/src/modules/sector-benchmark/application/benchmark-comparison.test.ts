import { describe, expect, it } from "vitest";
import type { OrganizationEconomicProfile } from "../../economic-profile/module.js";
import {
  buildComparison,
  computeEbitdaMargin,
  extractCae3,
} from "./benchmark-comparison.js";

function profile(overrides: Partial<OrganizationEconomicProfile> = {}): OrganizationEconomicProfile {
  return {
    id: "p1",
    organizationId: "o1",
    year: 2023,
    employees: 30,
    turnover: 4_000_000,
    ebitda: 600_000,
    balanceSheetTotal: 2_500_000,
    cae: "62010",
    source: "ies_extracted",
    confirmedAt: "2023-01-01T00:00:00Z",
    iesExtractionLogId: null,
    dimensao: "pequena",
    dimensaoSource: "ai_classified",
    dimensaoConfirmedAt: "2023-02-01T00:00:00Z",
    dimensaoRationale: [],
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-02-01T00:00:00Z",
    ...overrides,
  };
}

describe("extractCae3", () => {
  it("returns the 3-digit prefix of a 5-digit CAE", () => {
    expect(extractCae3("62010")).toBe("620");
  });

  it("strips non-digits before slicing (dots, spaces)", () => {
    expect(extractCae3("62.010")).toBe("620");
    expect(extractCae3(" 620 10 ")).toBe("620");
  });

  it("returns null on missing or too-short input", () => {
    expect(extractCae3(null)).toBeNull();
    expect(extractCae3("62")).toBeNull();
    expect(extractCae3("")).toBeNull();
  });
});

describe("computeEbitdaMargin", () => {
  it("computes the ratio when both values are present", () => {
    expect(computeEbitdaMargin(profile({ ebitda: 200_000, turnover: 1_000_000 }))).toBe(0.2);
  });

  it("returns null when turnover is zero (avoid div-by-zero)", () => {
    expect(computeEbitdaMargin(profile({ ebitda: 100_000, turnover: 0 }))).toBeNull();
  });

  it("returns null when ebitda is null", () => {
    expect(computeEbitdaMargin(profile({ ebitda: null }))).toBeNull();
  });
});

describe("buildComparison", () => {
  it("computes deltas vs the matched aggregate", () => {
    const c = buildComparison(profile({ turnover: 4_000_000, ebitda: 600_000 }), {
      cae3: "620",
      dimensao: "pequena",
      year: 2023,
      vintageYear: 2025,
      fonte: "placeholder_v1",
      nCompanies: 180,
      medianTurnover: 2_500_000,
      medianEbitdaMargin: 0.18,
      p25Turnover: null,
      p75Turnover: null,
    });
    expect(c.profile.ebitdaMargin).toBeCloseTo(0.15, 4);
    expect(c.deltas.turnoverVsMedian).toBe(1_500_000);
    // org margin 0.15, peer 0.18 → -0.03 (underperformer)
    expect(c.deltas.ebitdaMarginVsMedian).toBeCloseTo(-0.03, 4);
  });

  it("InsufficientData aggregate → null deltas, profile fields still populated", () => {
    const c = buildComparison(profile(), {
      insufficientData: true,
      reason: "no_aggregate_in_year_window",
      cae3: "620",
      dimensao: "pequena",
      year: 2023,
    });
    expect(c.deltas.turnoverVsMedian).toBeNull();
    expect(c.deltas.ebitdaMarginVsMedian).toBeNull();
    expect(c.profile.cae3).toBe("620");
    expect(c.profile.dimensao).toBe("pequena");
  });
});
