# V4 — Form Templates + Records

> **Status:** Not started
> **Depends on:** [V3 — PT Reference Data + Onboarding](03-pt-data-onboarding.md)
> **Parent PRD:** [../bgreen-greenfield-rewrite.md](../bgreen-greenfield-rewrite.md)
> **User stories covered:** PRD §23–35 (form builder, record submission, basic review)

## Goal

Org admins can define `RecordTemplate`s (e.g., "Monthly Energy Consumption") with typed fields, then data fillers submit `Record`s against those templates. Cross-template mappings auto-fill known values. Derived fields compute server-side. No formal workflow engine yet — submission has a flat "submitted / approved / rejected" status; full XState comes in V5.

## Acceptance criteria

- [ ] `FormTemplates` module created. Owns: `RecordTemplate`, plus the conceptual `FormSchema / RowSchema / FieldSchema / FieldType / FieldProperties / TemplateMapping` — all collapsed into a **single JSONB column** on `RecordTemplate`, validated by a zod schema in `packages/form-engine`.
- [ ] `Records` module created. Owns: `Record`, `Execution` (one row per submission), `Aggregator` (rollup placeholder — minimal usage in v1).
- [ ] Drizzle migrations: `record_templates` (with `form_schema` JSONB + GIN index), `records`, `record_executions`, `record_attachments`.
- [ ] **`FormSchemaInterpreter`** in `packages/form-engine` — pure function: `(schema: FormSchema, rawValues: unknown) => Result<ValidatedRecord, FormError[]>`. Handles: required, type coercion, numeric ranges, unit consistency, derived field computation, cross-row references, **repeating sub-row arrays, and conditional show-if visibility (fields hidden by show-if are not validated)**.
- [ ] Field types supported in v1: `number` (with unit), `date`, `select` (enum), **`multi_select`** (enum, multiple values), `text`, `file` (attachment ref), `calculated` (formula referencing other fields in same record), **`repeating`** (a nested `FormSchema`-like sub-row group with min/max rows, value is an array of sub-records).
- [ ] **Conditional show-if** on any field: `showIf: { fieldId, equals }` (single predicate in v1; AND-chains via multiple predicates if simple). Hidden fields are skipped during validation.
- [ ] **Template editor UI** (org admin): create template, add typed fields (incl. multi-select / repeating / show-if), configure validation rules, define cross-template mappings, publish/unpublish, clone existing template.
- [ ] **Record submission UI** (data filler): pick a published template → form rendered from `FormSchema` → real-time client-side validation → derived fields computed read-only → save as draft → submit.
- [ ] Attachment upload: file → presigned S3 URL (S3 EU bucket from V1's secrets stub; full `S3Uploader` deep module deferred to V6 but a minimal happy-path upload is fine here). Attachment metadata stored on `record_attachments`.
- [ ] "My submissions" list for the current user — shows status (`draft / submitted / approved / rejected`) per record.
- [ ] "Review queue" list for org admins — shows submitted records, allows approve/request-changes/reject with a comment. Flat status field for v4; XState replaces this in V5.
- [ ] Cross-template mapping rule example working end to end: month-N closing meter reading → month-N+1 opening meter reading prefills on draft create.
- [ ] All UI in pt-PT.

## In scope

- RecordTemplate + FormSchema-as-JSONB.
- FormSchemaInterpreter as the deep module.
- Records + Executions + Attachments.
- Template editor + Record submission + minimal review queue.
- Cross-template mapping rules.
- Field-type set above.

## Out of scope

- XState-driven workflows → V5 (replaces the flat status field).
- AuditLog → V5.
- Relationship-based FGA — review action is gated by role checks. V5 later kept row-based authorization.
- Real-time collaboration on the template editor → not in v1.
- Aggregator semantics beyond table existence → deferred.
- `S3Uploader` as a properly typed deep module → V6.
- File OCR / extraction → never for attachments; only for IES (V6).

## Module map

| Module | Status | Notes |
|---|---|---|
| FormTemplates | **new** | `RecordTemplate` (FormSchema as JSONB). |
| Records | **new** | `Record`, `Execution`, minimal `Aggregator`. |
| `packages/form-engine` | **new package** | Houses `FormSchemaInterpreter` + zod schema types. |

## Deep modules introduced

- **`FormSchemaInterpreter`** — pure. Tests cover: required field missing, type coercion (string→number with unit), numeric out of range, unit mismatch, derived-field arithmetic (CO₂e = activity × factor), cross-row references inside one record, malformed schema input, **multi-select option membership, repeating sub-row array (min/max rows, recursive validation per sub-record), conditional show-if (hidden required field does not error)**. ~18–22 cases.

## Open questions / risks

- **JSONB vs separate tables (FormSchema, RowSchema, FieldSchema, FieldProperties):** PRD locks JSONB. Risk: complex queries against form data. Mitigation: GIN index + only query inside zod-validated paths.
- **Calculated-field formulas:** allow arbitrary JS? Default: a tiny safe expression language (mathjs subset or hand-rolled) that references field IDs by name. No `eval`. Document the supported operators.
- **Cross-template mapping security:** mapping rules could leak data across templates. Mitigation: mapping target must reference a template owned by the same org; enforce in `FormSchemaInterpreter`.
- **Template editor complexity:** this is the most ambitious UI surface in v4. If it slips, ship with a JSON-edit fallback for admins until polish lands.
- **Recursive `repeating` editor UI:** the nested-row builder is meaningful UI work. Plan: one level of nesting in v1 (a `repeating` field cannot itself contain another `repeating` field); revisit on real customer demand.
- **Show-if predicate language:** v1 supports `{ fieldId, equals }` plus AND-chaining of multiple predicates. `OR`, `not`, numeric comparisons, etc. deferred to v1.5.

## Deployable artifact

End of vertical: org admin creates "Monthly Energy Consumption" template → publishes → data filler submits a record with kWh + invoice attachment + computed CO₂e → admin reviews + approves. Second month's draft auto-fills the opening meter from last month's closing.

## Notes for the next vertical (V5)

V5 replaces the flat `record.status` field with XState-driven workflows, adds the AuditLog, and formalizes row-based authorization. Records should be the first entity wired into both — keep the status field but plan to migrate it to `WorkflowInstance.current_state`.
