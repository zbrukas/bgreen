import { index, integer, numeric, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { organizationSizeEnum } from "./organization-size";

// V7.2 — one row per (cae3, dimensao, year, fonte) sector aggregate.
// SectorBenchmarkLookup reads from this table; the placeholder seed in
// scripts/ populates it with `fonte='placeholder_v1'`. Real BdP / INE
// imports later use distinct `fonte` values so the seed can be replaced
// without orphan rows.
export const sectorAggregates = pgTable(
  "sector_aggregates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 3-digit CAE code as a string (preserves leading zeros).
    cae3: text("cae3").notNull(),
    dimensao: organizationSizeEnum("dimensao").notNull(),
    year: integer("year").notNull(),
    // The vintage year of the source dataset (BdP often publishes with
    // a 2-3 year lag); UI surfaces this in the comparison footer.
    vintageYear: integer("vintage_year").notNull(),
    fonte: text("fonte").notNull(),
    nCompanies: integer("n_companies").notNull(),
    medianTurnover: numeric("median_turnover", { precision: 20, scale: 2 }),
    // Ratio (0.1500 = 15%). Box plot percentiles below are optional —
    // V7.2 ships medians only; p25/p75 are reserved for V8+ visualisations.
    medianEbitdaMargin: numeric("median_ebitda_margin", { precision: 5, scale: 4 }),
    p25Turnover: numeric("p25_turnover", { precision: 20, scale: 2 }),
    p75Turnover: numeric("p75_turnover", { precision: 20, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    sliceUnique: unique("sector_aggregates_slice_unique").on(
      t.cae3,
      t.dimensao,
      t.year,
      t.fonte,
    ),
    // Lookup hot path: filter by (cae3, dimensao) and order by year desc
    // when the exact year is missing.
    lookupIdx: index("sector_aggregates_lookup_idx").on(t.cae3, t.dimensao, t.year),
  }),
);

export type SectorAggregateRow = typeof sectorAggregates.$inferSelect;
export type NewSectorAggregateRow = typeof sectorAggregates.$inferInsert;
