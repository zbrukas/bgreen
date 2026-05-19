import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { legalFormEnum } from "./legal-form";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosOrganizationId: text("workos_organization_id").unique(),
  name: text("name").notNull(),
  legalForm: legalFormEnum("legal_form"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
