// SectorBenchmarkLookup — pure port. Real Drizzle impl lives in
// infrastructure/; tests use an in-memory variant.
//
// Year-fallback: exact match → prior year → InsufficientData if no row
// exists within a 3-year window. Picking the most-recent-known year
// inside the window matches PRD #19's "vintage disclosed" requirement —
// we never silently substitute much older data.

import type { Dimensao } from "../../economic-profile/application/dimensao-classifier.js";
import type { SectorBenchmarkLookupResult } from "../domain/types.js";

export interface SectorBenchmarkLookup {
  lookup(input: {
    cae3: string | null;
    dimensao: Dimensao | null;
    year: number;
  }): Promise<SectorBenchmarkLookupResult>;
}

// How many years back from the requested year we accept as a fallback.
// 3-year window per PRD #19 §52 ("Dados setoriais insuficientes" once
// the data is too stale).
export const YEAR_FALLBACK_WINDOW = 3;
