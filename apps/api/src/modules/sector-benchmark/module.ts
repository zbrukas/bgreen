export type {
  SectorBenchmarkLookup,
} from "./application/sector-benchmark-lookup.js";
export { YEAR_FALLBACK_WINDOW } from "./application/sector-benchmark-lookup.js";
export {
  buildComparison,
  computeEbitdaMargin,
  extractCae3,
  type BenchmarkComparison,
} from "./application/benchmark-comparison.js";
export type {
  InsufficientData,
  SectorAggregate,
  SectorBenchmarkLookupResult,
} from "./domain/types.js";
export { isInsufficientData } from "./domain/types.js";
export { DrizzleSectorBenchmarkLookup } from "./infrastructure/drizzle-sector-benchmark-lookup.js";
export { InMemorySectorBenchmarkLookup } from "./infrastructure/in-memory-sector-benchmark-lookup.js";
export { sectorBenchmarkRoutes } from "./api/routes.js";
