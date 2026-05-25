import { date, index, jsonb, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

// V12.2 — daily snapshot of `cs_org_health` per organisation. The view
// computes live; this table is the trend store the per-org drawer
// sparklines (V12.3) and the activation cohort chart read from.
//
// `metrics` is intentionally schemaless JSONB. The contract is the
// `CsHealthRow` zod schema in @bgreen/types — parsed on read. Lets the
// formula and signal set evolve without snapshot migrations.
export const csHealthSnapshots = pgTable(
  "cs_health_snapshots",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    snapshotDate: date("snapshot_date").notNull(),
    metrics: jsonb("metrics").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.snapshotDate] }),
    dateIdx: index("cs_health_snapshots_date_idx").on(t.snapshotDate),
  }),
);

export type CsHealthSnapshotRow = typeof csHealthSnapshots.$inferSelect;
export type NewCsHealthSnapshotRow = typeof csHealthSnapshots.$inferInsert;
