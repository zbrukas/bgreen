# modules/form-templates

Bounded context: `RecordTemplate` + the FormSchema JSONB it owns.

## Owns
- `RecordTemplate` aggregate (one JSONB column per template — see PRD's
  "form-builder collapsed to JSONB" decision).
- CRUD + publish/archive lifecycle. Status enum: draft → published → archived.

## Does NOT own
- FormSchema interpretation. That lives in `@bgreen/form-engine`; both
  this module and `modules/records` consume it.
- Submitted record data (`modules/records`).
- Cross-template mapping rules (V4.x).

## Public ports
- `RecordTemplateRepository` — interface.
- `RecordTemplateService` — create / get / list / update / publish / archive.

## Routes
- `GET    /record-templates`       — list templates for active org.
- `GET    /record-templates/:id`   — single template (org-scoped).
- `POST   /record-templates`       — admin only; status starts at `draft`.
- `PATCH  /record-templates/:id`   — admin only; partial update.
- `POST   /record-templates/:id/publish` — admin only.
- `POST   /record-templates/:id/archive` — admin only.

## Tenant scope
Every read/write filters by `organizationId` via `orgScope`. The auth
middleware populates `c.var.organizationId` from the active-org cookie.
