# modules/records

Bounded context: submitted ESG data instances against a `RecordTemplate`.

## Owns
- `Record` aggregate (one row per submission cycle).
- Flat status field (`draft / submitted / approved / changes_requested /
  rejected`). V5 replaces this with `WorkflowInstance` driven by XState.

## Does NOT own
- Form-schema interpretation (lives in `@bgreen/form-engine`).
- Template lifecycle (`modules/form-templates`).
- Reviewer workflow transitions (V4.4; for now any admin can read every
  org record, and submitters can read only their own).
- Attachments (V4.5/V6).

## Public ports
- `RecordRepository`
- `RecordService.submit(input)` — runs FormSchemaInterpreter against the
  template's JSONB; returns typed `SubmitResult`.

## Routes
- `GET  /records`      — list (admins: org-wide; members: own).
- `GET  /records/:id`  — single record (members: own only).
- `POST /records`      — submit. Body: `{ templateId, values, asDraft? }`.
  Status defaults to `submitted` unless `asDraft: true`.

## Tenant scope
Every read/write filters by `organizationId` via `orgScope`.
