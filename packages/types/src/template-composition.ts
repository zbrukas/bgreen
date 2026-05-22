import { z } from "zod";

export const TemplateCompositionSchema = z.object({
  mainTemplateId: z.string().uuid(),
  subTemplateId: z.string().uuid(),
  position: z.number().int(),
});
export type TemplateComposition = z.infer<typeof TemplateCompositionSchema>;
