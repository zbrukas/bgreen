import { z } from "zod";
import { LegalFormSchema } from "./legal-form";

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  workosOrganizationId: z.string().nullable(),
  name: z.string().min(1),
  legalForm: LegalFormSchema.nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Organization = z.infer<typeof OrganizationSchema>;
