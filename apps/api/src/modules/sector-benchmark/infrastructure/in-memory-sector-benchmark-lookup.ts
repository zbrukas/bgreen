// In-memory SectorBenchmarkLookup. Same contract as the Drizzle impl;
// used by the unit tests so we don't need a live Postgres for lookup
// behaviour. Also a viable test-double inside future integration tests
// of the route layer.

import type { Dimensao } from "../../economic-profile/application/dimensao-classifier.js";
import {
  type SectorBenchmarkLookup,
  YEAR_FALLBACK_WINDOW,
} from "../application/sector-benchmark-lookup.js";
import type {
  SectorAggregate,
  SectorBenchmarkLookupResult,
} from "../domain/types.js";

export class InMemorySectorBenchmarkLookup implements SectorBenchmarkLookup {
  private readonly aggregates: SectorAggregate[] = [];

  seed(rows: SectorAggregate[]): void {
    this.aggregates.push(...rows);
  }

  lookup(input: {
    cae3: string | null;
    dimensao: Dimensao | null;
    year: number;
  }): Promise<SectorBenchmarkLookupResult> {
    if (!input.cae3) {
      return Promise.resolve({
        insufficientData: true as const,
        reason: "missing_cae" as const,
        cae3: null,
        dimensao: null,
        year: input.year,
      });
    }
    if (!input.dimensao) {
      return Promise.resolve({
        insufficientData: true as const,
        reason: "missing_dimensao" as const,
        cae3: input.cae3,
        dimensao: null,
        year: input.year,
      });
    }
    const cae3 = input.cae3;
    const dimensao = input.dimensao;
    const candidates = this.aggregates
      .filter(
        (a) =>
          a.cae3 === cae3 &&
          a.dimensao === dimensao &&
          a.year <= input.year &&
          a.year > input.year - YEAR_FALLBACK_WINDOW,
      )
      .sort((a, b) => b.year - a.year);
    const match = candidates[0];
    if (!match) {
      return Promise.resolve({
        insufficientData: true as const,
        reason: "no_aggregate_in_year_window" as const,
        cae3,
        dimensao,
        year: input.year,
      });
    }
    return Promise.resolve(match);
  }
}
