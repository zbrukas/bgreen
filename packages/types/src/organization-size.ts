import { z } from "zod";

// EU Recommendation 2003/361/EC SME bands. Names stay PT lowercase to
// match the Drizzle enum.
export const OrganizationSizeSchema = z.enum(["micro", "pequena", "media", "grande"]);
export type OrganizationSize = z.infer<typeof OrganizationSizeSchema>;
