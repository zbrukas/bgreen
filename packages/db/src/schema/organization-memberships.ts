import { index, pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// V5.4 reshape: was ['admin','member']; now three explicit org-side
// roles. admin → org_admin; member → org_user_write (sensible default).
// org_user_read is new.
export const membershipRoleEnum = pgEnum("membership_role", [
  "org_admin",
  "org_user_write",
  "org_user_read",
]);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("org_user_write"),
    // V5.5 topic scoping placeholder.
    topicScope: text("topic_scope").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
    orgIdx: index("org_memb_org_idx").on(table.organizationId),
  }),
);

export type OrganizationMembershipRow = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembershipRow = typeof organizationMemberships.$inferInsert;
