import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { recordTemplates } from "./record-templates";
import { users } from "./users";

// V10.1 — framework datapoint catalog + admin mappings.
//
// `framework_datapoints` is a reference catalog. Seeded from
// @bgreen/frameworks via apps/api/scripts/seed-framework-datapoints.ts;
// no per-org data lives here.
//
// `template_datapoint_mappings` is the admin-edited join: which
// RecordTemplate satisfies which datapoint. One template can map to
// many datapoints; one datapoint can be satisfied by many templates.
// Per V10 plan §criteria, only org admins can edit; the mapping is
// global (CS-managed templates → catalog), so org_id isn't part of
// the key — the admin role check happens upstream at the route layer.

export const frameworkEnum = pgEnum("framework", ["esrs", "ghg", "gri"]);

export const frameworkDatapoints = pgTable(
  "framework_datapoints",
  {
    // Stable internal slug from @bgreen/frameworks. Used as the FK
    // target for template mappings + audit rows + AI prompt context.
    id: text("id").primaryKey(),
    framework: frameworkEnum("framework").notNull(),
    // Pillar / topic — "E1" for ESRS climate, "Scope 1" for GHG, etc.
    topic: text("topic").notNull(),
    // Framework-issued code, surfaced verbatim in the UI.
    code: text("code").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    // SectorApplicability rule. Two shapes today:
    //   { kind: "all" }
    //   { kind: "cae3-list", values: string[] }
    // Stored as JSONB so future shapes (CAE-3 range, dimensao filter)
    // don't need a migration.
    sectorApplicability: jsonb("sector_applicability").notNull(),
    version: text("version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    frameworkIdx: index("framework_datapoints_framework_idx").on(t.framework, t.topic),
  }),
);

export type FrameworkDatapointRow = typeof frameworkDatapoints.$inferSelect;
export type NewFrameworkDatapointRow = typeof frameworkDatapoints.$inferInsert;

export const templateDatapointMappings = pgTable(
  "template_datapoint_mappings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => recordTemplates.id, { onDelete: "cascade" }),
    frameworkDatapointId: text("framework_datapoint_id")
      .notNull()
      .references(() => frameworkDatapoints.id, { onDelete: "cascade" }),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // One row per (template, datapoint) — re-adding the same mapping
    // is a no-op via ON CONFLICT.
    pairUnique: unique("template_datapoint_mappings_pair_unique").on(
      t.templateId,
      t.frameworkDatapointId,
    ),
    templateIdx: index("template_datapoint_mappings_template_idx").on(t.templateId),
    datapointIdx: index("template_datapoint_mappings_datapoint_idx").on(t.frameworkDatapointId),
  }),
);

export type TemplateDatapointMappingRow = typeof templateDatapointMappings.$inferSelect;
export type NewTemplateDatapointMappingRow = typeof templateDatapointMappings.$inferInsert;
