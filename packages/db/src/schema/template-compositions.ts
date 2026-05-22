import { integer, pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { recordTemplates } from "./record-templates";

// Ordered list of sub-templates embedded in a main template. Position is a
// stable integer (10, 20, 30, …) so re-ordering only writes the moved row.
export const templateCompositions = pgTable(
  "template_compositions",
  {
    mainTemplateId: uuid("main_template_id")
      .notNull()
      .references(() => recordTemplates.id, { onDelete: "cascade" }),
    subTemplateId: uuid("sub_template_id")
      .notNull()
      .references(() => recordTemplates.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.mainTemplateId, t.subTemplateId] }),
  }),
);

export type TemplateCompositionRow = typeof templateCompositions.$inferSelect;
export type NewTemplateCompositionRow = typeof templateCompositions.$inferInsert;
