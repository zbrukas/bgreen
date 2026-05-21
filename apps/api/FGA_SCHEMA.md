# WorkOS FGA schema for bGreen

This is the schema bGreen expects in the WorkOS FGA dashboard. Deploy it
once when bringing up a fresh workspace; keep it in sync as new roles
land.

## DSL

```
type user

type organization
  relation org_admin: [user]
  relation org_user_write: [user]
  relation org_user_read: [user]

type central_services_workspace
  relation admin: [user]
  relation maintainer: [user]
  relation promoter: [user]

type record_template
  relation parent: [central_services_workspace]
  relation editor: admin from parent | maintainer from parent

type record
  relation parent: [organization]
  relation submitter: [user]
  relation reviewer: [user]
```

## Singleton resource ids

* `central_services_workspace`: the well-known zero UUID `00000000-0000-0000-0000-000000000000`.

## Seeding

* The API's boot routine (`apps/api/src/seed-global-admin.ts`) writes
  `(user:<global-admin>, admin, central_services_workspace:<zero-uuid>)`
  every time the process starts if `GLOBAL_ADMIN_EMAIL` is set.
* New CS users seeded via the domain table (`UserService.syncFromWorkos`)
  get `(user, maintainer, central_services_workspace)` on first sign-in.
* `pnpm --filter @bgreen/api seed-fga` walks the DB and idempotently
  back-fills warrants for every existing org membership + every CS user.
  Run after deploying the schema for the first time.

## v1 limitations

* `record.reviewer` is granted ad hoc by the API right now (CS admins
  and maintainers can review any record). A derived relation
  (`reviewer from parent.organization`'s certifier-like fan-out) is left
  for V5.7 once per-section workflows are needed.
* No `record_template.editor` writes — for v1 every CS admin/maintainer
  can edit every template, and the route just checks the workspace
  relation. Per-template fine grain comes when content teams scale.
