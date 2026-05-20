import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { legalFormEnum } from "./legal-form";
import { organizationSizeEnum } from "./organization-size";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workosOrganizationId: text("workos_organization_id").unique(),
  name: text("name").notNull(),
  nif: text("nif").unique(),
  caeCode: text("cae_code"),
  legalForm: legalFormEnum("legal_form"),
  selfReportedSize: organizationSizeEnum("self_reported_size"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
