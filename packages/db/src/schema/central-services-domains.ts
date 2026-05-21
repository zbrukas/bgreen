import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

// Email domains that classify a fresh sign-up as a central-services user.
// CS admins manage this list through the CS console. The matching happens
// on first WorkOS sync; once a user row is created the user_type is
// immutable. GLOBAL_ADMIN_EMAIL is special-cased separately at boot.
export const centralServicesDomains = pgTable("central_services_domains", {
  id: uuid("id").primaryKey().defaultRandom(),
  // Domain stored without the leading "@", lowercased. Unique.
  domain: text("domain").notNull().unique(),
  note: text("note"),
  createdByUserId: uuid("created_by_user_id").references(() => users.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type CentralServicesDomainRow = typeof centralServicesDomains.$inferSelect;
export type NewCentralServicesDomainRow = typeof centralServicesDomains.$inferInsert;
