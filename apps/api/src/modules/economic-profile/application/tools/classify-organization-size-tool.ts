// classifyOrganizationSize — AI narrative on top of the deterministic
// DimensaoClassifier.
//
// Design (per V7 plan): the deterministic classifier is the source of
// truth for `dimensao`. The AI's job is to produce a friendly pt-PT
// narrative explanation suitable for the proposal banner. The route
// layer feeds the classifier's output into this tool and validates
// that the AI's returned `dimensao` matches — any mismatch is rejected
// at the boundary as `output_parse`, preventing the model from
// silently re-classifying.
//
// Registered for V7.1; the active V7.1 UI uses the classifier's
// structured rationale directly. Wiring this tool in is a one-line
// swap in the route handler when the product wants richer narrative.

import { defineAiTool } from "@bgreen/ai";
import { z } from "zod";

const dimensaoSchema = z.enum(["micro", "pequena", "media", "grande"]);

export const classifyOrganizationSizeInputSchema = z.object({
  // Profile snapshot. The AI sees the raw values + the deterministic
  // result and writes the narrative; it cannot disagree with the
  // dimensao (output validation enforces this).
  profile: z.object({
    employees: z.number().int().nullable(),
    turnover: z.number().nullable(),
    balanceSheetTotal: z.number().nullable(),
  }),
  deterministicResult: z.object({
    dimensao: dimensaoSchema,
    structuredRationale: z.array(
      z.object({
        rule: z.string(),
        message: z.string(),
      }),
    ),
  }),
});

export type ClassifyOrganizationSizeInput = z.infer<typeof classifyOrganizationSizeInputSchema>;

export const classifyOrganizationSizeOutputSchema = z.object({
  // Must match the deterministic dimensao. The model is not free to
  // re-classify; the field is here so the model commits to the same
  // value in its narrative and we can detect drift via outputSchema
  // refinement at the route layer.
  dimensao: dimensaoSchema,
  // 1-3 sentence pt-PT explanation. Concrete numbers + the band's
  // human label. Avoids hedging language.
  rationale: z.string().min(20).max(800),
  // Model's self-reported confidence in the narrative quality (not in
  // the classification — that's deterministic). 'high' when both
  // head-count and a financial criterion were provided.
  confidence: z.enum(["high", "medium", "low"]),
});

export type ClassifyOrganizationSizeOutput = z.infer<typeof classifyOrganizationSizeOutputSchema>;

export const classifyOrganizationSizeTool = defineAiTool({
  name: "classify_organization_size",
  description:
    "Produz uma explicação em pt-PT da classificação de dimensão da empresa segundo a Recomendação " +
    "Europeia 2003/361/EC. Recebe os valores económicos e a banda determinada pelo classificador " +
    "determinístico — o teu papel é narrar, não reclassificar.",
  inputSchema: classifyOrganizationSizeInputSchema,
  outputSchema: classifyOrganizationSizeOutputSchema,
  systemPrompt: [
    "És o narrador da classificação de dimensão de PME segundo a Recomendação Europeia 2003/361/EC.",
    "",
    "Recebes:",
    "- profile: head-count + turnover + ativo total da empresa.",
    "- deterministicResult: a banda calculada por um classificador determinístico (fonte da verdade)",
    "  e a lista de regras que dispararam.",
    "",
    "Devolves uma explicação em 1–3 frases que:",
    "- usa números concretos (ex. '32 colaboradores e €4.8M de volume de negócios').",
    "- nomeia a banda em maiúsculas (MICRO, PEQUENA, MÉDIA, GRANDE).",
    "- evita linguagem hesitante.",
    "",
    "REGRAS CRÍTICAS:",
    "- O campo dimensao na tua resposta TEM de ser igual a deterministicResult.dimensao. Não reclassifiques.",
    "- Não inventes dados que não te foram dados.",
  ].join("\n"),
  buildUserMessage: (input) => [
    {
      type: "text",
      text:
        `Profile: ${JSON.stringify(input.profile)}\n` +
        `Deterministic result: ${JSON.stringify(input.deterministicResult)}\n` +
        `Escreve a explicação.`,
    },
  ],
  maxTokens: 512,
});
