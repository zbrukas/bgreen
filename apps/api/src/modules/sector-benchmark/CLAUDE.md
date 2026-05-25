# modules/sector-benchmark

Bounded context: sector aggregate lookups for the benchmark comparison
UI. Reads from `sector_aggregates` (no writes — seeds populate that
table; admin imports later via a CS-only tool).

## Owns
- `SectorAggregate` domain type + `InsufficientData` sentinel.
- `SectorBenchmarkLookup` deep module — pure lookup port with year-
  fallback semantics.
- Drizzle adapter that backs the port against `sector_aggregates`.
- `/sector-benchmark/compare` route (V7.2).

## Does NOT own
- Sector aggregate writes / seed scripts (apps/api/scripts/).
- Size classification (modules/economic-profile).

## Lookup contract
`lookup(cae3, dimensao, year) → SectorAggregate | InsufficientData`

Year-fallback: exact match → prior year (year - 1) → InsufficientData.
A 3-year fallback window is the v1 ceiling; older data is intentionally
not surfaced (benchmark vintage is too stale to be useful).
