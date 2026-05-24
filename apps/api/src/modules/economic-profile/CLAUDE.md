# modules/economic-profile

Bounded context: per-year economic snapshot of an organization, sourced
from IES extraction or manual entry.

## Owns
- `OrganizationEconomicProfile` aggregate (one row per year per org).
- `IesExtractionLog` aggregate (one row per extraction attempt).
- `PerfilEconomicoValidator` — pure cross-validation rules ported from
  PRD #19 §19. Confidence-downgrading; never blocks the flow.
- (V6.3+) `IesExtractionService` — orchestrates the Inngest pipeline:
  classify → extract → validate → persist → S3 cleanup.

## Does NOT own
- AI transport. Lives in `@bgreen/ai`.
- Object storage. Lives in `@bgreen/storage`.
- Sector benchmark joins / size classification. V7.
- Recommendations. V8.

## Public ports (planned)
- `EconomicProfileRepository`
- `IesExtractionLogRepository`
- `IesExtractionService.start({ orgId, file })` (V6.3)
- `IesExtractionService.confirm({ logId, edits })` (V6.4)

## Scope this vertical (V6.2)
- Drizzle schemas (`organization_economic_profiles`, `ies_extraction_logs`)
  live in `@bgreen/db`.
- `PerfilEconomicoValidator` ships here in `application/`.
- No routes, services, or repositories yet — V6.3/V6.4 land those.
