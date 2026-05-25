# modules/recommendations

Bounded context: AI-generated ESG recommendation runs + per-item user
feedback. Each "Gerar recomendações" click produces one
`generated_recommendations` row; the AI output is a JSONB array.

## Owns
- `GeneratedRecommendation` aggregate (one row per run).
- `RecommendationFeedback` aggregate (per-item, per-user).
- `RecommendationsService` — composes ProfileGatherer + AI tool call +
  parse + persist (V9.2).
- `generateRecommendations` AI tool definition (V9.1 — schema only;
  wired into the orchestrator in V9.2).
- Completeness-mode classifier (FULL / PARTIAL / INCOMPLETE).
- `/recommendations` routes (V9.2).

## Does NOT own
- AI transport. Lives in `@bgreen/ai`.
- Profile data. Read via EconomicProfile + Records modules.
- Sector benchmarks. Read via SectorBenchmark module.
- AI client observer / audit. Reuses the V6 hook.

## Public ports (planned)
- `GeneratedRecommendationRepository`
- `RecommendationFeedbackRepository`
- `RecommendationsService.generate({ orgId, userId })` (V9.2)
- `RecommendationsService.recordFeedback({ ... })` (V9.2)

## Scope this vertical (V9.1)
- Drizzle schemas live in `@bgreen/db`.
- Pure `classifyCompleteness` ships here with tests.
- `generateRecommendations` AI tool defined + registered.
- No service / routes yet — V9.2 lands those.
