import { pgEnum } from "drizzle-orm/pg-core";

// PT NaturezaJuridica values — jurisdiction-specific, names stay PT (per parent PRD G-1).
// Initial subset; full reference list seeded in V3.
export const legalFormEnum = pgEnum("legal_form", [
  "sociedade_anonima",
  "sociedade_quotas",
  "sociedade_unipessoal_quotas",
  "empresario_individual",
  "associacao",
  "cooperativa",
  "outro",
]);
