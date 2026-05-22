import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

// V5.4 introduces a hard population split: every user is either part of
// the bGreen central-services team or belongs to one or more customer
// organisations. The split is immutable once set — enforced at the
// service layer, not the schema.
export const userTypeEnum = pgEnum("user_type", ["central_services", "organization"]);

// Roles a central-services user can hold. Org-side roles live on
// organization_memberships. Null for organization users.
export const centralServicesRoleEnum = pgEnum("central_services_role", [
  "admin",
  "maintainer",
  "promoter",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Nullable from V5.7: CS users use local email+password auth; org users
  // still authenticate via WorkOS. The unique constraint tolerates NULLs.
  workosUserId: text("workos_user_id").unique(),
  email: text("email").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  userType: userTypeEnum("user_type").notNull().default("organization"),
  centralServicesRole: centralServicesRoleEnum("central_services_role"),
  // V5.7: argon2id hash for CS users. NULL = setup-password flow required.
  passwordHash: text("password_hash"),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;
