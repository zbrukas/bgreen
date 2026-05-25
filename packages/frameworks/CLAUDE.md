# packages/frameworks — ESG framework datapoint catalogs

Bounded context: static reference data for the V10 framework coverage
checker. ESRS / GHG Protocol / GRI datapoint catalogs in TypeScript so
the seed step is a pure module import + insert (no JSON parsing).

## Owns
- `FrameworkDatapoint` shape (id, framework, topic, datapoint code,
  title, description, sector applicability rule).
- ESRS E1 climate datapoint subset (~30 most-applicable).
- GHG Protocol Scope 1/2/3 datapoint subset (~15).
- GRI disclosure subset relevant to PT mid-caps (~20).
- `evaluateSectorApplicability(rule, cae3)` — pure predicate used by
  CoverageCalculator (V10.2).

## Does NOT own
- Coverage calculation logic. Lives in V10.2's CoverageCalculator
  inside `apps/api/src/modules/framework-coverage/`.
- DB schema or repositories. The catalog is *seeded into* the
  `framework_datapoints` table by an apps/api script.
- AI explanations. Lives in V10.3.

## Versioning
- Each datapoint carries a `version` string (`"esrs-2024"`,
  `"ghgp-2015"`, `"gri-2021"`). New revisions add new entries; old
  revisions stay in the seed so historical coverage runs don't break.

## Sector applicability
Two shapes:
- `{ kind: "all" }` — applies to every CAE-3.
- `{ kind: "cae3-list", values: ["351", "352", ...] }` — applies only
  to listed CAE-3 prefixes.

Energy-intensive sectors get a curated CAE-3 list (351 electricity,
352 gas, 191 coke, 192 petroleum, 241 iron/steel, 242 metallurgy, 23x
cement/glass/ceramics). The list is conservative — when in doubt the
v1 seed marks "all" and the UI filter lets users hide non-applicable.
