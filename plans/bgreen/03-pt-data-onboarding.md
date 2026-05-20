# V3 — PT Reference Data + Onboarding

> **Status:** Not started
> **Depends on:** [V2 — Identity + Organizations](02-identity-organizations.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §16–22 (signup wizard, NIF, VIES, CAE, legal form, size self-assessment)

## Goal

Replace the placeholder "Create organization" step from V2 with a proper Portuguese-jurisdiction signup wizard: NIF entry → VIES prefill → CAE picker → legal form → self-assessed size. Manual fallback when VIES is down. Reference data seeded at boot.

## Acceptance criteria

- [ ] `packages/pt-data` populated with seed JSON for:
  - [ ] CAE Rev.3 catalogue (~800 rows) sourced from INE.
  - [ ] `NaturezaJuridica` enum values (legal forms) — exact PT values, not translated.
  - [ ] `Concelho` (308), `Freguesia` (~3000), `Distrito` (18) — for postal-code lookups.
  - [ ] `CodigoPostal` ranges or fixed dataset (CTT-derived if licensed; static seed otherwise).
- [ ] Drizzle migration creates `cae`, `distrito`, `concelho`, `freguesia`, `codigo_postal` tables.
- [ ] Drizzle seed script populates the reference tables on first boot (idempotent).
- [ ] `Geography` module — read-only API for postal-code → freguesia/concelho/distrito.
- [ ] `ReferenceData` module — read-only API for CAE search + legal form list.
- [ ] **`NifValidator`** deep module — pure mod-11 checksum. Exposed as `validateNif(input: string): { valid: boolean; reason?: string }`.
- [ ] **`ViesClient`** deep module — REST call to EU VIES with: 4s timeout, in-memory cache (24h TTL), graceful-degrade returning `null` on failure. Exposed as `lookup(nif: string): Promise<ViesResult | null>`.
- [ ] Signup wizard UI in `apps/web`:
  - [ ] Step 1: NIF input with as-you-type validation (red border on invalid checksum, green on valid).
  - [ ] Step 2 (auto): VIES lookup runs in background; on hit, fields pre-fill with "Verificado via VIES" badge; on miss/timeout, user fills manually.
  - [ ] Step 3: CAE picker — searchable dropdown over CAE Rev.3 catalogue (search by code or description).
  - [ ] Step 4: Legal form dropdown from `NaturezaJuridica` enum.
  - [ ] Step 5: Self-assessed size (MICRO / PEQUENA / MÉDIA / GRANDE) with plain-language descriptions.
  - [ ] Step 6: Review + confirm → creates `Organization` row.
- [ ] All wizard copy in pt-PT.
- [ ] Telemetry: VIES hit-rate, VIES error-rate, wizard drop-off per step (PostHog events).
- [ ] Existing V2 placeholder org-create flow removed/replaced.

## In scope

- PT reference data seeds + read APIs.
- NIF validator + VIES client (deep, testable).
- Signup wizard end to end.
- Self-assessed size (column on Organization or OrganizationEconomicProfile — see open questions).

## Out of scope

- IES upload / extraction → V6.
- Sector benchmarking → V7.
- AI-assisted classification of size → V7 (this vertical uses self-report only).
- Editing org details post-signup → minimal "edit" UI deferred unless needed for QA.

## Module map

| Module | Status | Notes |
|---|---|---|
| Geography | **new** | Pais, CodigoPostal, Distrito, Concelho, Freguesia. PT names stay PT (jurisdiction terms). |
| ReferenceData | **new** | CAE Rev.3 catalogue, LegalForm enum values. |
| Organizations | **extended** | Adds `nif`, `cae`, `legal_form`, `address` (composite), `self_reported_size` columns. |

## Deep modules introduced

- **`NifValidator`** — pure function. Tests cover: valid NIFs (1, 2, 5, 6, 8, 9 prefix variants), invalid checksum, wrong length, non-numeric, leading zeros. ~10 cases.
- **`ViesClient`** — happy path with stubbed HTTP response in V3 (~1 test). Full resilience tests (cache TTL, timeout, retry) deferred until evidence of flakiness.

## Open questions / risks

- **VIES quota / rate limits:** EU VIES is rate-limited per source IP. At zero customers this is fine; if growth hits the limit, in-memory cache + per-NIF dedupe should buffer.
- **`self_reported_size` location:** lives on `Organization` (cheap to read) or on a new `OrganizationEconomicProfile` row (carries through to V7 cleanly)? **Default:** `OrganizationEconomicProfile` with `source = 'self_report'`, so V6/V7 just add new rows with `source = 'ies'`.
- **CTT postal-code licensing:** if licensed dataset isn't obtainable cheaply, fall back to a static seed of postal-code ranges. Pilot users can correct manually.

## Deployable artifact

End of vertical: a new user lands at signup → wizard runs → org created with `nif`, `cae`, `legal_form`, `address`, `self_reported_size`. If VIES is down, user completes signup anyway. All reference tables populated.

## Notes for the next vertical (V4)

V4 builds the form-builder and Records — the first place where users start producing ESG data. Expect Organization to be referenced by every record going forward; the tenant-scope helper from V2 is load-bearing.
