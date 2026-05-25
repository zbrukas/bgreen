import { z } from "zod";
import { LegalFormSchema } from "./legal-form";
import { OrganizationSizeSchema } from "./organization-size";

export const OrganizationSchema = z.object({
  id: z.string().uuid(),
  workosOrganizationId: z.string().nullable(),
  name: z.string().min(1),
  nif: z.string().nullable(),
  caeCode: z.string().nullable(),
  legalForm: LegalFormSchema.nullable(),
  selfReportedSize: OrganizationSizeSchema.nullable(),
  postalCode: z.string().nullable(),
  addressLine: z.string().nullable(),
  freguesia: z.string().nullable(),
  concelho: z.string().nullable(),
  distrito: z.string().nullable(),
  // V11.1 branding — both nullable; defaults applied at render time.
  logoUrl: z.string().nullable(),
  brandPrimaryColor: z.string().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});

export type Organization = z.infer<typeof OrganizationSchema>;
