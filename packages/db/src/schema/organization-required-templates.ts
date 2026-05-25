import { index, pgEnum, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { recordTemplates } from "./record-templates";
import { users } from "./users";

// V12.1 — Customer Success required-template assignments. CS staff
// assign templates to organisations with a cadence; the cs_org_health
// view joins this against `records` to compute `coveragePercent`. Org
// admins don't manage these in v1 — assignment is a CS responsibility.
export const requirementRecurrenceEnum = pgEnum("requirement_recurrence", [
  "annual",
  "quarterly",
  "monthly",
  "once",
]);

export const organizationRequiredTemplates = pgTable(
  "organization_required_templates",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => recordTemplates.id, { onDelete: "restrict" }),
    recurrence: requirementRecurrenceEnum("recurrence").notNull(),
    // When the first period for this assignment was expected. Drives
    // current_period_start() in V12.2's coverage query.
    firstDueAt: timestamp("first_due_at", { withTimezone: true }).notNull(),
    assignedByUserId: uuid("assigned_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.organizationId, t.templateId] }),
    orgIdx: index("org_required_templates_org_idx").on(t.organizationId),
  }),
);

export type OrganizationRequiredTemplateRow =
  typeof organizationRequiredTemplates.$inferSelect;
export type NewOrganizationRequiredTemplateRow =
  typeof organizationRequiredTemplates.$inferInsert;
