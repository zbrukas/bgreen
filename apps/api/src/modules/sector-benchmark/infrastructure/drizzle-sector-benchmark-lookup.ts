import { db, schema } from "@bgreen/db";
import { and, desc, eq, gte, lte } from "drizzle-orm";
import type { Dimensao } from "../../economic-profile/application/dimensao-classifier.js";
import {
  type SectorBenchmarkLookup,
  YEAR_FALLBACK_WINDOW,
} from "../application/sector-benchmark-lookup.js";
import type {
  InsufficientData,
  SectorAggregate,
  SectorBenchmarkLookupResult,
} from "../domain/types.js";

type Row = typeof schema.sectorAggregates.$inferSelect;

function parseMoney(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseRatio(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToAggregate(row: Row): SectorAggregate {
  return {
    cae3: row.cae3,
    dimensao: row.dimensao,
    year: row.year,
    vintageYear: row.vintageYear,
    fonte: row.fonte,
    nCompanies: row.nCompanies,
    medianTurnover: parseMoney(row.medianTurnover),
    medianEbitdaMargin: parseRatio(row.medianEbitdaMargin),
    p25Turnover: parseMoney(row.p25Turnover),
    p75Turnover: parseMoney(row.p75Turnover),
  };
}

export class DrizzleSectorBenchmarkLookup implements SectorBenchmarkLookup {
  async lookup(input: {
    cae3: string | null;
    dimensao: Dimensao | null;
    year: number;
  }): Promise<SectorBenchmarkLookupResult> {
    if (!input.cae3) return missingCae(input.year);
    if (!input.dimensao) return missingDimensao(input.cae3, input.year);

    // Pull the newest row in the [year - 3, year] window matching the
    // slice. Single index scan against (cae3, dimensao, year DESC).
    const rows = await db
      .select()
      .from(schema.sectorAggregates)
      .where(
        and(
          eq(schema.sectorAggregates.cae3, input.cae3),
          eq(schema.sectorAggregates.dimensao, input.dimensao),
          lte(schema.sectorAggregates.year, input.year),
          gte(schema.sectorAggregates.year, input.year - YEAR_FALLBACK_WINDOW + 1),
        ),
      )
      .orderBy(desc(schema.sectorAggregates.year))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return noAggregateInWindow(input.cae3, input.dimensao, input.year);
    }
    return rowToAggregate(row);
  }
}

function missingCae(year: number): InsufficientData {
  return {
    insufficientData: true,
    reason: "missing_cae",
    cae3: null,
    dimensao: null,
    year,
  };
}

function missingDimensao(cae3: string, year: number): InsufficientData {
  return {
    insufficientData: true,
    reason: "missing_dimensao",
    cae3,
    dimensao: null,
    year,
  };
}

function noAggregateInWindow(
  cae3: string,
  dimensao: Dimensao,
  year: number,
): InsufficientData {
  return {
    insufficientData: true,
    reason: "no_aggregate_in_year_window",
    cae3,
    dimensao,
    year,
  };
}
