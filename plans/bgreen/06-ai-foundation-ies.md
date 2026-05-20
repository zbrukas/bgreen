# V6 — AI Foundation + IES Extraction

> **Status:** Not started
> **Depends on:** [V5 — Workflows + Audit + FGA](05-workflows-audit-fga.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §40–47 (IES upload + extraction), §75–78 (failure modes), and the AI-infra prerequisites for §54+ in later verticals

## Goal

Build the AI plumbing that every subsequent vertical depends on, then ship the first end-to-end AI feature: IES PDF upload → doc classification → Claude tool-use extraction → cross-validation → persisted log → S3 cleanup. The aim is "the AI moving parts work for one real flow before V7/V8 stack more on top."

## Acceptance criteria

### AI infrastructure

- [ ] `packages/ai` houses **`AnthropicAiClient`** — typed facade over `@anthropic-ai/sdk`. Features:
  - Per-tool registration via zod schemas (auto-converted to Anthropic tool definitions).
  - Prompt caching for system prompt + tool definitions.
  - Retry with exponential backoff on transient errors.
  - pt-PT system-prompt prefix enforced.
  - `call<TInput, TOutput>(tool, input): Promise<Result<TOutput, AiError>>` API.
- [ ] Anthropic API key set as Fly secret; never reaches `apps/web`. All AI calls from `apps/api`.
- [ ] Bedrock EU adapter scaffolded but disabled (one env var + one file to flip). Confirmed not in code path.
- [ ] Tool registry includes (at minimum, this vertical):
  - `classifyDocument(input: { documentText: string }) → { kind: 'ies' | 'invoice' | 'other'; confidence: 'high' | 'medium' | 'low' }`
  - `extractEconomicProfile(input: { iesText: string }) → { year, employees, turnover, ebitda, balanceSheetTotal, cae, confidencePerField: ... }`
- [ ] **`S3Uploader`** deep module — `upload`, `presignedUrl`, `delete`, all typed; hides AWS SDK shape. EU bucket (Frankfurt or Ireland).
- [ ] Inngest configured in EU region. Step-function orchestration available from `apps/api`.
- [ ] All AI tool calls write a `tool_call` row to `audit_log` (action `ai.tool_call`) with input + output (sans PII redaction policy that we revisit later) + tokens used + latency.
- [ ] PostHog event per AI call: tool name, success/failure, latency, token cost approximation.

### IES extraction flow

- [ ] **`IesExtractionService`** orchestrates a 5-step Inngest pipeline:
  1. PDF arrives in S3 → text extraction (use `pdf-parse` or similar; OCR explicitly out of scope).
  2. `classifyDocument` tool call — if not `ies`, abort with pt-PT user-facing error.
  3. `extractEconomicProfile` tool call — returns structured fields + per-field confidence.
  4. **`PerfilEconomicoValidator`** (deep module, ported from PRD #19) cross-validates ranges, plausibility (EBITDA margin sanity), year window. Downgrades confidence on suspect values.
  5. Persist `IesExtractionLog` row + per-field results; delete S3 object.
- [ ] `EconomicProfile` module created with `OrganizationEconomicProfile` (per-year) + `IesExtractionLog`. (Schemas land here; rich consumption lives in V7.)
- [ ] IES upload UI:
  - Click-through consent modal stating "Authorize AI processing; document deleted after extraction."
  - Drag-drop or file picker for a PDF.
  - Progress indicator tied to Inngest run state.
  - Result screen shows extracted fields with confidence badges (HIGH / MEDIUM / LOW) and inline edit per field.
  - "Confirm & save" persists the user-edited values.
  - "Manual entry" link always visible as bypass.
- [ ] Dashboard CTA for users without an IES uploaded yet: "Upload IES para desbloquear recomendações" (or similar pt-PT copy).
- [ ] Error messages all pt-PT: not-an-IES, AI timeout, validation failure (with the specific rule that fired).

## In scope

- AnthropicAiClient + S3Uploader + Inngest setup.
- Two tool definitions (`classifyDocument`, `extractEconomicProfile`).
- IesExtractionService end to end.
- PerfilEconomicoValidator deep module.
- IES upload UI + click-through consent.
- Consumption of extracted profile is **minimal** here: stored + editable + viewable. The benchmarking and size-classification UX comes in V7.

## Out of scope

- Sector benchmark lookup → V7.
- Size classification UI / `classifyOrganizationSize` tool → V7 (the tool may be registered now if convenient, but UI lives in V7).
- Recommendations → V8.
- Report commentary → V10.
- AI eval suite → v1.5 entirely.
- Circuit breaker on Anthropic itself → deferred (basic retry only).
- Rate limiting / cost budgets / kill switch → deferred.

## Module map

| Module | Status | Notes |
|---|---|---|
| `packages/ai` | **new package** | AnthropicAiClient, tool registry, Bedrock adapter (disabled). |
| `EconomicProfile` | **new (schema only this vertical)** | Schemas land; full consumption in V7. |
| `Audit` | **extended** | Audits AI tool calls. |
| Inngest setup | **new** | EU region, step functions. |
| `S3Uploader` (in `packages/ai` or its own package) | **new** | EU bucket wrapper. |

## Deep modules introduced

- **`AnthropicAiClient`** — interface tested with stubbed SDK; behavior tests (retry, caching, error mapping) covered. Real-AI behavior tests deferred to v1.5 eval suite.
- **`S3Uploader`** — happy-path tests with `@aws-sdk/client-s3-mock` or LocalStack; covers upload, presign, delete, missing-object error mapping. ~6 cases.
- **`PerfilEconomicoValidator`** — pure. Tests: out-of-range employees (negative, > 10M), negative turnover, implausible EBITDA ratio (> 500%), future year, missing required field. Confirms LOW-confidence override. ~10 cases.

## Open questions / risks

- **PDF text extraction quality:** `pdf-parse` struggles on column layouts. Mitigation: if extraction quality is poor on real contabilista PDFs, fall back to Claude reading the PDF natively (multimodal). Document the choice.
- **GDPR audit trail vs S3 deletion:** PRD says delete IES from S3 after extraction. But AuditLog stores the extracted JSON — is that "the same data" for GDPR? Default: yes, AuditLog payload IS the regulated data; that's the point of an audit trail. Right-to-erasure tombstones the audit row's actor reference and clears `payload` (keeps row for chain integrity).
- **Token cost at zero customers:** OK. Per-org cost budgets in v1.5.
- **Anthropic outage:** retry covers transient; full outage means IES extraction fails and user falls back to manual entry. No formal circuit breaker.

## Deployable artifact

End of vertical: a user uploads an IES PDF → consent modal → Inngest pipeline runs → result screen shows 6–8 extracted fields with confidence badges → user edits one field → confirms → `OrganizationEconomicProfile` + `IesExtractionLog` persisted → S3 object deleted → AuditLog rows present for every AI call.

## Notes for the next vertical (V7)

V7 reads the `OrganizationEconomicProfile` written here and turns it into UX value: SME size classification, sector benchmark comparison, insufficient-data fallbacks. The `classifyOrganizationSize` tool joins the registry.
