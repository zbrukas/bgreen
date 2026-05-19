import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const schemaVersion = pgTable("_schema_version", {
  id: serial("id").primaryKey(),
  version: text("version").notNull(),
  appliedAt: timestamp("applied_at", { withTimezone: true }).notNull().defaultNow(),
});
