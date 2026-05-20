import { pgEnum } from "drizzle-orm/pg-core";

// EU Recommendation 2003/361/EC SME bands. We keep PT lowercase form
// in the DB; the UI maps to capitalised display strings.
export const organizationSizeEnum = pgEnum("organization_size", [
  "micro",
  "pequena",
  "media",
  "grande",
]);
