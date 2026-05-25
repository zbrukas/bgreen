# V9 — Recommendations

> **Status:** In progress — V9.1 + V9.2 shipped.
> **Depends on:** [V7 — Economic Profile + Sector Benchmarks](07-economic-profile-benchmarks.md), [V8 — Scoring + Dashboards](08-scoring-dashboards.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)

## Sub-slice progress

- **V9.1 (shipped):** AI tool + classifier + schemas + module shell. `generateRecommendations` tool registered (zod-validated 4-15 items per call; pt-PT system prompt forbids regulatory citations per v1.5 deferral; branches tone by completenessMode). `classifyCompleteness` (pure) FULL/PARTIAL/INCOMPLETE selector — 6 unit tests covering each signal combination. Migration 0018 adds `generated_recommendations` (status enum, completeness_mode enum, recommendations jsonb, token + Inngest run snapshot) + `recommendation_feedback` (kind enum, UNIQUE on (gen, index, user) so switching feedback updates rather than appends). Module shell at `apps/api/src/modules/recommendations/` with CLAUDE.md scoping ownership.
- **V9.2 (shipped):** ProfileGatherer + RecommendationsService + Inngest function + routes + audit hook. `ProfileGatherer` composes EconomicProfile + SectorBenchmark + Records into the AI tool input (latest profile year, peer medians, per-template record counts, latest scores). `RecommendationsService` owns the start→Inngest→runGeneration roundtrip + per-item feedback upsert + history listing. Inngest function `recommendations-generation` (concurrency 5, retries 2) calls `runGeneration` off the `recommendations.generation.started` event. Routes: POST `/recommendations` (start), GET `/recommendations` (history; admin sees all, member sees own), GET `/recommendations/:id` (poll), POST `/recommendations/:id/feedback` (upsert per-item kind). AI observer extended via `context.metadata.entityKind` so `ai.tool_call.generate_recommendations` writes against `generated_recommendation`; the service also writes its own `recommendations.generate` and `recommendations.feedback` audit rows. 16 service tests + 6 completeness tests; full monorepo typecheck green; 134 tests in apps/api.
- **V9.3 (next):** UI — Gerar button, polling, result cards with feedback chips, history, preliminary mode.
> **User stories covered:** PRD §54–63 (recommendations + feedback)

## Goal

Ship the core product loop: a user clicks "Gerar recomendações" → Claude produces a targeted list of ecological measures referencing their profile + records + sector peers → user reviews, gives per-recommendation feedback → bGreen captures it. Generation is purely AI in v1; a curated library comes in v1.5.

## Acceptance criteria

- [ ] `Recommendations` module created. Owns `GeneratedRecommendation` (one row per generation run; output is a JSONB array of recommendations) + `RecommendationFeedback` (per-item feedback).
- [ ] Drizzle migrations: `generated_recommendations`, `recommendation_feedback`.
- [ ] **`RecommendationsService`** — composes prompt-build + Claude call + parse + persist. Three prompt modes by profile completeness:
  - `FULL` — IES uploaded, dimensao confirmed, ≥1 ESG record submitted.
  - `PARTIAL` — IES uploaded but no records, or records but no IES.
  - `INCOMPLETE` — neither IES nor records; only self-reported size + sector.
- [ ] AI tool: `generateRecommendations(input) → { recommendations: Array<{ title, description, estimatedImpact, implementationEffort, timeHorizon, rationale }>; profileCompleteness }`. Schema lives in `packages/ai`, generated once.
- [ ] All recommendation text generated in pt-PT. System prompt enforces it.
- [ ] UI: dashboard "Gerar recomendações" button. Loading state during Inngest run. Result page shows recommendations as cards: title, impact badge (alto/médio/baixo), effort badge, horizon (curto/médio/longo prazo), expandable rationale, "Aplicado", "Ignorar" actions.
- [ ] Banner: "Recomendações geradas por IA — valide com o seu consultor." Always visible on recommendations screens.
- [ ] Per-recommendation feedback buttons: `útil`, `já implementada`, `não aplicável`, `irrelevante`, `incorreta`. One feedback per (user, recommendation) — switching the choice updates the existing row.
- [ ] "Regenerar" button produces a new generation run. Previous runs preserved in history.
- [ ] History view per organization: list of past generation runs (date, profile completeness, count of items, count of "útil" feedback). Click a run to view its contents.
- [ ] Preliminary recommendations work for INCOMPLETE-mode users: as soon as signup wizard (V3) completes, a "ver recomendações preliminares" CTA is available. No paywall.
- [ ] Profile-completeness gating logic decides which mode to use. Tested.
- [ ] Recommendations factor in any ESG `Record` data the org has submitted (V4) — the prompt builder pulls aggregated record data into context.
- [ ] FGA gates generation: only `member` and `admin` of the org can trigger generation; admins can see all generations; members see their own + org-shared.
- [ ] Every generation run writes to AuditLog (`action = 'recommendations.generate'`) with profile-completeness mode + token cost.

## In scope

- RecommendationsService + tool registration.
- FULL / PARTIAL / INCOMPLETE prompt modes.
- Recommendations card UI + feedback enum.
- History.
- Preliminary recommendations for INCOMPLETE users.
- AI banner.

## Out of scope

- Curated recommendation library + AI selection from library → v1.5.
- Regulatory citations in recommendations → v1.5 (hallucination risk too high without a verified reference library).
- Cross-org recommendation analytics → admin tool, not in v1.
- "Apply this recommendation" flows that mutate other modules → not in v1; the action is "I read it" not "do it for me."

## Module map

| Module | Status | Notes |
|---|---|---|
| Recommendations | **new** | `GeneratedRecommendation` + `RecommendationFeedback`. |
| `packages/ai` | **extended** | Registers `generateRecommendations` tool with zod schema. |
| Audit | **extended** | Captures generation runs + feedback events. |

## Deep modules introduced

- **`RecommendationsService`** orchestration — composition of `ProfileGatherer` + `PromptBuilder` + `AnthropicAiClient.call('generateRecommendations', ...)` + parser + persistence. Tests focus on:
  - Prompt-mode selection logic (FULL vs PARTIAL vs INCOMPLETE).
  - Parser robustness to malformed AI output (defensive zod parse with fallback to retry).
  - Persistence shape correctness.
- Real AI-quality tests deferred to v1.5 eval suite.

## Open questions / risks

- **Recommendation quality without an eval suite:** v1 ships pure-AI generation; quality is what Claude gives us. Mitigation: capture feedback aggressively (the whole point of `RecommendationFeedback`), seed the v1.5 curated library from "útil" + "já implementada" patterns.
- **Hallucinated regulatory citations:** prompt explicitly forbids citing specific regulations or articles in v1. Out-of-scope clause in this plan + system-prompt guardrail.
- **Cost per generation:** ~10K-30K tokens per run. Acceptable at zero customers. Per-org budgets in v1.5.
- **pt-PT consistency:** Claude occasionally drifts to pt-BR. Mitigation: system prompt is explicit; eval suite (v1.5) will catch regressions.
- **Recommendation freshness vs determinism:** clicking "Gerar" twice produces different outputs. v1 accepts this; preservation of history mitigates "I liked the last one better."

## Deployable artifact

End of vertical: a user with a confirmed profile clicks "Gerar recomendações" → 60-90 seconds later they see 8-12 prioritized recommendations in pt-PT with rationale → they tag 3 as "útil", 1 as "já implementada", 1 as "incorreta" → history view shows the run with feedback counts → preliminary recommendations also work for a brand-new user with only a self-reported size.

## Notes for the next vertical (V10)

V10 turns the regulatory-coverage checker on. Recommendations could reference detected gaps ("you're missing E1-6 disclosure — here's how to start"), but the cross-feature integration is deferred. V9 ships standalone; V10 adds an adjacent surface.
