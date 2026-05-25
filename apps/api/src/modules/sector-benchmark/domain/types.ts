// Domain types for sector benchmark lookups.

import type { Dimensao } from "../../economic-profile/application/dimensao-classifier.js";

export interface SectorAggregate {
  cae3: string;
  dimensao: Dimensao;
  year: number;
  vintageYear: number;
  fonte: string;
  nCompanies: number;
  medianTurnover: number | null;
  medianEbitdaMargin: number | null;
  p25Turnover: number | null;
  p75Turnover: number | null;
}

// Returned by SectorBenchmarkLookup when no aggregate exists within
// the year-fallback window. `reason` carries the structured cause so
// the UI can render specific pt-PT copy ("Dados setoriais insuficientes
// para CAE-3 = 712 em empresas PEQUENA").
export interface InsufficientData {
  insufficientData: true;
  reason:
    | "no_aggregate_for_cae3_and_dimensao"
    | "no_aggregate_in_year_window"
    | "missing_cae"
    | "missing_dimensao";
  cae3: string | null;
  dimensao: Dimensao | null;
  year: number;
}

export type SectorBenchmarkLookupResult = SectorAggregate | InsufficientData;

export function isInsufficientData(
  result: SectorBenchmarkLookupResult,
): result is InsufficientData {
  return "insufficientData" in result && result.insufficientData === true;
}
