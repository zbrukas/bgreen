import { pgEnum, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

export const membershipRoleEnum = pgEnum("membership_role", ["admin", "member"]);

export const organizationMemberships = pgTable(
  "organization_memberships",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    role: membershipRoleEnum("role").notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.userId, table.organizationId] }),
  }),
);

export type OrganizationMembershipRow = typeof organizationMemberships.$inferSelect;
export type NewOrganizationMembershipRow = typeof organizationMemberships.$inferInsert;
