# modules/framework-coverage

Bounded context: V10 framework coverage checker. Reads the
framework datapoint catalog + CS-managed template↔datapoint mappings
+ the org's submitted records, computes a per-datapoint coverage
matrix.

## Owns
- `CoverageCalculator` — pure: maps (framework, datapoints, mappings,
  records, profile) → `CoverageRow[]`.
- `FrameworkDatapointRepository` — read-only catalog lookups.
- `TemplateDatapointMappingRepository` — CRUD for CS-managed
  template ↔ datapoint mappings.
- `CoverageService` — thin orchestration; composes the repos +
  calculator. V10.3 wraps this with an AI explanation pass.
- `/framework-datapoints` and `/framework-coverage/:framework` GETs.
- `/template-datapoint-mappings` POST/DELETE (CS-only).

## Does NOT own
- Datapoint catalog source-of-truth. Lives in `@bgreen/frameworks`;
  seeded into `framework_datapoints` by an apps/api script.
- AI-generated explanations. V10.3 adds `CoverageExplanationService`.
- Mapping suggestions / auto-mapping. Deferred to v1.5 per V10 plan.

## Authorization
- Read routes: any authenticated user with org membership.
- Mapping CRUD: `canCsWrite` (CS admin or maintainer). The mapping
  is global (templates are CS-owned since V5.4), so org-admin write
  was the V10 plan's pre-V5.4 wording; we honor the V5.4 reality.

## Audit
- Mapping create / delete writes audit rows under `entityKind =
  "record_template"`, `entityId = templateId`, action
  `record_template.datapoint_mapped` / `.datapoint_unmapped`. Org id
  is the CS workspace UUID.
