# packages/pt-data — Portuguese reference data

Bounded context: static seeds + read APIs for jurisdiction-specific data.

## Owns (from V3 onward)
- CAE Rev.3 catalogue (~800 rows).
- Concelho, Freguesia, Distrito tables.
- CodigoPostal seed.
- NaturezaJuridica enum values.
- Drizzle seed script.

## Does NOT own
- Organization data that *references* this seed (lives in `apps/api/src/modules/organizations`).

## Naming
- Table + column + entity names stay PT (`cae`, `freguesia`, …). Jurisdiction-specific terms don't translate cleanly.
