import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

// PT statistical sector classification (CAE Rev.4). Codes are 2–5 chars and
// hierarchical: 2 = division, 3 = group, 4 = class, 5 = subclass.
export const ptCae = pgTable(
  "pt_cae",
  {
    code: text("code").primaryKey(),
    description: text("description").notNull(),
    level: integer("level"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    descriptionIdx: index("pt_cae_description_idx").on(table.description),
  }),
);

// PT postal codes (XXXX-XXX) → locality/district. Seeded from CTT-derived
// open data (centraldedados/codigos_postais).
export const ptPostalCodes = pgTable(
  "pt_postal_codes",
  {
    postalCode: text("postal_code").primaryKey(),
    freguesia: text("freguesia"),
    concelho: text("concelho"),
    distrito: text("distrito"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    freguesiaIdx: index("pt_postal_codes_freguesia_idx").on(table.freguesia),
  }),
);

export type PtCaeRow = typeof ptCae.$inferSelect;
export type NewPtCaeRow = typeof ptCae.$inferInsert;
export type PtPostalCodeRow = typeof ptPostalCodes.$inferSelect;
export type NewPtPostalCodeRow = typeof ptPostalCodes.$inferInsert;
