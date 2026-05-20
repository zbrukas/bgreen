import { z } from "zod";
import { LegalFormSchema } from "./legal-form";
import { OrganizationSizeSchema } from "./organization-size";

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  workosOrganizationId: z.string().nullable(),
  name: z.string().min(1),
  nif: z.string().nullable(),
  legalForm: LegalFormSchema.nullable(),
  selfReportedSize: OrganizationSizeSchema.nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Organization = z.infer<typeof OrganizationSchema>;
