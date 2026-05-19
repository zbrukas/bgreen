import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { membershipRoleEnum } from "./organization-memberships";
import { organizations } from "./organizations";
import { users } from "./users";

export const inviteStatusEnum = pgEnum("invite_status", [
  "pending",
  "accepted",
  "revoked",
  "expired",
]);

export const organizationInvites = pgTable("organization_invites", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  invitedEmail: text("invited_email").notNull(),
  role: membershipRoleEnum("role").notNull(),
  token: text("token").notNull().unique(),
  invitedByUserId: uuid("invited_by_user_id")
    .notNull()
    .references(() => users.id),
  status: inviteStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  acceptedByUserId: uuid("accepted_by_user_id").references(() => users.id),
});

export type OrganizationInviteRow = typeof organizationInvites.$inferSelect;
export type NewOrganizationInviteRow = typeof organizationInvites.$inferInsert;
