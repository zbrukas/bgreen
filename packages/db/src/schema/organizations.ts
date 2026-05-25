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
  postalCode: text("postal_code"),
  addressLine: text("address_line"),
  freguesia: text("freguesia"),
  concelho: text("concelho"),
  distrito: text("distrito"),
  // V11.1 branding — surfaced on PDF report covers, headers, accent
  // colors. Both nullable; orgs without a brand fall back to the
  // bGreen default palette. logo_url points at an S3 object key the
  // PDF service resolves at render time.
  logoUrl: text("logo_url"),
  brandPrimaryColor: text("brand_primary_color"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OrganizationRow = typeof organizations.$inferSelect;
export type NewOrganizationRow = typeof organizations.$inferInsert;
