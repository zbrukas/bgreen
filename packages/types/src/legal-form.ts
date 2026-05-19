import { z } from "zod";

// PT NaturezaJuridica subset. Values stay PT (jurisdiction-specific).
// Must stay in sync with packages/db/src/schema/legal-form.ts.
export const LegalFormSchema = z.enum([
  "sociedade_anonima",
  "sociedade_quotas",
  "sociedade_unipessoal_quotas",
  "empresario_individual",
  "associacao",
  "cooperativa",
  "outro",
]);

export type LegalForm = z.infer<typeof LegalFormSchema>;
