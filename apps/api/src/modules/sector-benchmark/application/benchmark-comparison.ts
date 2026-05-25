// Build a comparison view: the org's profile for a year alongside the
// matched sector aggregate. Pure given (profile, aggregate).
//
// Derivation rules:
//   - cae3 = first 3 digits of profile.cae (CAE Rev.3 codes are 5
//     digits; the 3-digit prefix is the sector slice).
//   - dimensao comes from profile.dimensao (must be confirmed first;
//     null → missing_dimensao InsufficientData).
//   - turnoverVsMedian = profile.turnover - median (null if either
//     side is null).
//   - ebitdaMargin = profile.ebitda / profile.turnover (null if either
//     is null or turnover is zero).
//
// The route layer calls SectorBenchmarkLookup with the derived slice
// and folds the result into BenchmarkComparison or BenchmarkComparison-
// with-InsufficientData.

import type { OrganizationEconomicProfile } from "../../economic-profile/module.js";
import type { SectorBenchmarkLookupResult } from "../domain/types.js";

export interface BenchmarkComparison {
  profile: {
    year: number;
    cae3: string | null;
    dimensao: OrganizationEconomicProfile["dimensao"];
    turnover: number | null;
    ebitda: number | null;
    ebitdaMargin: number | null;
  };
  aggregate: SectorBenchmarkLookupResult;
  // Convenience deltas. Null when either side is missing — the UI
  // hides those rows rather than rendering "—" everywhere.
  deltas: {
    turnoverVsMedian: number | null;
    ebitdaMarginVsMedian: number | null;
  };
}

export function extractCae3(cae: string | null): string | null {
  if (!cae) return null;
  const cleaned = cae.replace(/[^0-9]/g, "");
  if (cleaned.length < 3) return null;
  return cleaned.slice(0, 3);
}

export function computeEbitdaMargin(profile: OrganizationEconomicProfile): number | null {
  if (profile.ebitda === null || profile.turnover === null || profile.turnover === 0) {
    return null;
  }
  return profile.ebitda / profile.turnover;
}

export function buildComparison(
  profile: OrganizationEconomicProfile,
  aggregate: SectorBenchmarkLookupResult,
): BenchmarkComparison {
  const ebitdaMargin = computeEbitdaMargin(profile);
  const turnoverVsMedian =
    "insufficientData" in aggregate
      ? null
      : profile.turnover !== null && aggregate.medianTurnover !== null
        ? profile.turnover - aggregate.medianTurnover
        : null;
  const ebitdaMarginVsMedian =
    "insufficientData" in aggregate
      ? null
      : ebitdaMargin !== null && aggregate.medianEbitdaMargin !== null
        ? ebitdaMargin - aggregate.medianEbitdaMargin
        : null;
  return {
    profile: {
      year: profile.year,
      cae3: extractCae3(profile.cae),
      dimensao: profile.dimensao,
      turnover: profile.turnover,
      ebitda: profile.ebitda,
      ebitdaMargin,
    },
    aggregate,
    deltas: { turnoverVsMedian, ebitdaMarginVsMedian },
  };
}
