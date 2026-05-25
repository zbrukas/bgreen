# modules/cs-admin

Bounded context: Customer Success operational surface — required-template
assignments (V12.1), CS-side health endpoints (V12.2), and any future
admin-only telemetry. Sits behind the CS-admin authz gate
(`users.userType='central_services'` AND `centralServicesRole IN
('admin','maintainer')`).

## Owns
- `OrganizationRequiredTemplate` aggregate (one row per org × template).
- `RequiredTemplateService` — assignment CRUD with audit-log emission.
- (V12.2) `CsHealthService` — reads `cs_org_health` view + snapshots,
  exposes filtering, cohort calculation.
- `/cs/required-templates` routes (V12.1).
- `/cs/health` routes (V12.2).

## Does NOT own
- The health-score formula. Lives in pure `@bgreen/cs-telemetry`.
- The SQL view + snapshot job. View lives in `packages/db/migrations`;
  the cron is wired in `apps/api/src/inngest.ts`.
- Org-side template CRUD. Belongs in `modules/form-templates`.

## Tenant scope
Reads are explicitly cross-tenant — every entry point goes through
`adminBypassScope()` from `packages/db/tenant-scope.ts`. Constructor
of services takes a resolved authz context; throws if not CS-admin.

## Routes
- `POST   /cs/required-templates`             — admin/maintainer only.
  Body: `{ organizationId, templateId, recurrence, firstDueAt }`.
- `DELETE /cs/required-templates/:organizationId/:templateId` — same gate.
