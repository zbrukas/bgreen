# modules/lookups

Bounded context: read-only fan-out to external reference systems
(VIES today; ePostalCode / Sitio das Empresas / others later).

## Owns
- HTTP routes that proxy external lookups through our auth surface.
- Composition of `@bgreen/pt-data` clients with auth + caching policy.

## Does NOT own
- Persistence of looked-up data (callers decide what to keep).
- Static reference data (CAE catalog lives in `@bgreen/pt-data` and is
  bundled client-side; no API route needed).

## Routes
- `GET /lookups/vies/:nif` — VIES VAT lookup. Validates the NIF locally
  first, then calls EU VIES. Returns 200 always when the NIF is valid;
  `source: "unreachable"` when VIES doesn't respond, so the form falls
  back to manual entry without surfacing transient failures.
