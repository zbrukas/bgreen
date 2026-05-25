// generateRecommendations — the V9 main event. One call → 8-12
// pt-PT recommendations grounded in the org's profile, scores, and
// sector deltas.
//
// Design choices (PRD #19 + V9 plan):
//   - The completenessMode (FULL/PARTIAL/INCOMPLETE) is passed in by
//     the orchestrator. The tool's system prompt branches its tone
//     and depth based on the mode rather than us building three
//     separate tools.
//   - No regulatory citations in v1 — hallucination risk too high
//     without a verified reference library (V9 plan §open questions).
//     System prompt forbids them explicitly.
//   - pt-PT is non-negotiable. The @bgreen/ai PT_PT_SYSTEM_PREFIX
//     covers the basics; this tool's system prompt restates it for
//     belt-and-suspenders given the model's drift to pt-BR on long
//     outputs.

import { defineAiTool } from "@bgreen/ai";
import { z } from "zod";

// Coarse buckets the UI renders as colored badges. pt-PT slugs so the
// model can write them without translation.
const impactSchema = z.enum(["alto", "medio", "baixo"]);
const effortSchema = z.enum(["alto", "medio", "baixo"]);
const horizonSchema = z.enum(["curto", "medio", "longo"]);

const completenessSchema = z.enum(["FULL", "PARTIAL", "INCOMPLETE"]);

const profileSnapshotSchema = z.object({
  // Self-reported (V3) or confirmed (V7) — the prompt doesn't care
  // which, just the band label.
  size: z.enum(["micro", "pequena", "media", "grande"]).nullable(),
  // CAE-3 (3-digit) when known. Drives sector-specific suggestions.
  cae3: z.string().nullable(),
  // Latest economic profile when present.
  year: z.number().int().nullable(),
  employees: z.number().int().nullable(),
  turnover: z.number().nullable(),
  ebitda: z.number().nullable(),
  ebitdaMargin: z.number().nullable(),
  // Sector medians for the matching slice (V7.2 SectorBenchmark).
  peerMedianTurnover: z.number().nullable(),
  peerMedianEbitdaMargin: z.number().nullable(),
  // Aggregated record counts so the AI knows what data the user has
  // submitted without us pushing the entire JSONB.
  recordCountsByTemplate: z
    .array(
      z.object({
        templateName: z.string(),
        recordCount: z.number().int(),
        latestScorePct: z.number().nullable(),
        latestTier: z.string().nullable(),
      }),
    )
    .default([]),
});

export const generateRecommendationsInputSchema = z.object({
  completenessMode: completenessSchema,
  profile: profileSnapshotSchema,
});

export type GenerateRecommendationsInput = z.infer<typeof generateRecommendationsInputSchema>;

const recommendationSchema = z.object({
  title: z.string().min(10).max(140),
  description: z.string().min(40).max(800),
  estimatedImpact: impactSchema,
  implementationEffort: effortSchema,
  timeHorizon: horizonSchema,
  // Cite the specific profile/records reason. UI shows in an
  // expandable section.
  rationale: z.string().min(30).max(600),
});

export const generateRecommendationsOutputSchema = z.object({
  recommendations: z.array(recommendationSchema).min(4).max(15),
  // Echo the mode so we can spot if the model ignored the input
  // (validation kicks in at the orchestrator boundary).
  completenessMode: completenessSchema,
});

export type GenerateRecommendationsOutput = z.infer<typeof generateRecommendationsOutputSchema>;

export const generateRecommendationsTool = defineAiTool({
  name: "generate_recommendations",
  description:
    "Gera entre 8 e 12 recomendações ESG accionáveis para uma empresa portuguesa, " +
    "baseadas no perfil económico, registos ESG submetidos, e comparação com pares " +
    "do setor. Cada recomendação inclui impacto, esforço e horizonte estimados.",
  inputSchema: generateRecommendationsInputSchema,
  outputSchema: generateRecommendationsOutputSchema,
  systemPrompt: [
    "És o motor de recomendações ESG do bGreen. Geras recomendações concretas, accionáveis e ancoradas no perfil específico da empresa.",
    "",
    "ENTRADA",
    "Recebes:",
    "- completenessMode: FULL (perfil completo), PARTIAL (parte do perfil), ou INCOMPLETE (só tamanho + setor).",
    "- profile: snapshot económico + registos ESG + medianas setoriais.",
    "",
    "MODO E PROFUNDIDADE",
    "- FULL → 10-12 recomendações específicas, citando os números concretos da empresa e do setor.",
    "- PARTIAL → 8-10 recomendações; reconhece os dados em falta sem inventar.",
    "- INCOMPLETE → 6-8 recomendações genéricas adaptadas ao setor e dimensão; instiga o utilizador a carregar o IES para sugestões mais específicas.",
    "",
    "FORMATO DE CADA RECOMENDAÇÃO",
    "- title: 5-12 palavras, imperativo (ex.: \"Reduzir consumo energético dos edifícios em 15%\").",
    "- description: 2-4 frases concretas sobre o que fazer.",
    "- estimatedImpact, implementationEffort, timeHorizon: alto/medio/baixo / curto/medio/longo.",
    "- rationale: 1-3 frases que citam números do perfil da empresa (\"a vossa margem EBITDA está 4pp abaixo da mediana setorial\").",
    "",
    "REGRAS",
    "- Toda a resposta em pt-PT (português europeu).",
    "- Não inventes números. Se não vês um campo, não o cites.",
    "- Não cites artigos de regulamentos específicos (CSRD, ESRS, etc.) — em v1 evitamos referências precisas que possam ser inventadas.",
    "- Não promovas produtos ou marcas específicos.",
    "- Diversidade temática: cobre energia, mobilidade, governance, fornecedores, pessoas, água, resíduos — conforme aplicável ao setor.",
  ].join("\n"),
  buildUserMessage: (input) => [
    {
      type: "text",
      text:
        `Modo: ${input.completenessMode}\n` +
        `Perfil:\n${JSON.stringify(input.profile, null, 2)}\n\n` +
        `Gera as recomendações.`,
    },
  ],
  // ~10K-30K tokens out per V9 plan §open questions. Cap at 8000 to
  // bound runaway responses (the model usually fills 4-6K with the
  // structured output).
  maxTokens: 8000,
});
