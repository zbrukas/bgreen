// generateReportCommentary — V11.3 AI commentary pass. Produces 3-6
// pt-PT executive-summary sections that wrap the deterministic data
// tables in the PDF cover.
//
// Design choices (V11 plan §criteria + open questions):
//   - The model writes narrative *grounded in the numbers we pass in*.
//     The system prompt forbids inventing figures: "Não inventes
//     números. Se não vês um campo, não o cites." (matches V9 + V10
//     anti-hallucination posture.)
//   - No regulatory citations beyond the framework label. v1 doesn't
//     trust the model with specific article references — they hallucinate.
//   - The output schema enforces 3-6 sections with bounded narrative
//     length so the cover page stays one-page-fits-A4.

import { defineAiTool } from "@bgreen/ai";
import { z } from "zod";

const frameworkSchema = z.enum(["ghg-inventory", "esrs-e1", "custom"]);

const profileSnapshotSchema = z.object({
  organizationName: z.string().min(1).max(200),
  // Self-reported (V3) or confirmed (V7) size band.
  size: z.enum(["micro", "pequena", "media", "grande"]).nullable(),
  cae3: z.string().nullable(),
  year: z.number().int().nullable(),
  employees: z.number().int().nullable(),
  turnover: z.number().nullable(),
  ebitda: z.number().nullable(),
  ebitdaMargin: z.number().nullable(),
  peerMedianTurnover: z.number().nullable(),
  peerMedianEbitdaMargin: z.number().nullable(),
});

// Coverage rollup the AI sees — when the template is ESRS E1 we pass
// the V10 counts so the model can comment on completeness honestly.
const coverageSummarySchema = z
  .object({
    covered: z.number().int().min(0),
    partial: z.number().int().min(0),
    missing: z.number().int().min(0),
  })
  .nullable();

// Emissions rollup the AI sees for GHG / ESRS E1 reports. Null for
// Custom templates that don't track emissions.
const emissionsSummarySchema = z
  .object({
    scope1Total: z.number().nullable(),
    scope2LocationTotal: z.number().nullable(),
    scope3Total: z.number().nullable(),
  })
  .nullable();

export const generateReportCommentaryInputSchema = z.object({
  template: frameworkSchema,
  period: z.object({
    start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  profile: profileSnapshotSchema,
  emissions: emissionsSummarySchema,
  coverage: coverageSummarySchema,
  // Aggregated record counts per template — same shape as V9's
  // recommendations input. Lets the model speak to how much data
  // backs the report.
  recordCountsByTemplate: z
    .array(
      z.object({
        templateName: z.string(),
        recordCount: z.number().int(),
      }),
    )
    .max(40)
    .default([]),
});

export type GenerateReportCommentaryInput = z.infer<
  typeof generateReportCommentaryInputSchema
>;

const sectionSchema = z.object({
  title: z.string().min(5).max(80),
  narrative: z.string().min(40).max(800),
  callouts: z.array(z.string().min(10).max(280)).max(4).default([]),
});

export const generateReportCommentaryOutputSchema = z.object({
  sections: z.array(sectionSchema).min(3).max(6),
});

export type GenerateReportCommentaryOutput = z.infer<
  typeof generateReportCommentaryOutputSchema
>;

export const generateReportCommentaryTool = defineAiTool({
  name: "generate_report_commentary",
  description:
    "Gera 3-6 secções de resumo executivo em pt-PT para um relatório ESG, " +
    "ancoradas nos dados submetidos (emissões, cobertura, perfil económico).",
  inputSchema: generateReportCommentaryInputSchema,
  outputSchema: generateReportCommentaryOutputSchema,
  systemPrompt: [
    "És o autor do resumo executivo dos relatórios ESG do bGreen. Para cada relatório recebes os dados já calculados; escreves 3-6 secções de narrativa breve.",
    "",
    "ENTRADA",
    "Recebes:",
    "- template: ghg-inventory | esrs-e1 | custom.",
    "- period: intervalo do relatório.",
    "- profile: snapshot económico (CAE-3, dimensão, turnover, EBITDA, medianas setoriais).",
    "- emissions: totais de Âmbito 1/2/3 quando aplicável (pode ser null).",
    "- coverage: contagens cobertas/parciais/em falta quando aplicável (ESRS E1).",
    "- recordCountsByTemplate: quantos registos suportam o relatório.",
    "",
    "REGRAS",
    "- Toda a resposta em pt-PT (português europeu).",
    "- NÃO inventes números. Se um campo é null, não o cites.",
    "- NÃO cites artigos específicos de regulamentos. Usa apenas o nome do framework (CSRD/ESRS, GHG Protocol, GRI).",
    "- NÃO promovas produtos ou marcas.",
    "- Cita o setor (CAE-3) e a dimensão quando ajudam a contextualizar.",
    "- Compara com medianas setoriais quando disponíveis ('a vossa margem EBITDA está 4pp abaixo da mediana').",
    "",
    "ESTRUTURA SUGERIDA",
    "- ghg-inventory → introdução, perfil de emissões, comparação setorial, próximos passos.",
    "- esrs-e1 → cobertura geral, áreas fortes, lacunas críticas, prioridades imediatas.",
    "- custom → estrutura mais flexível adaptada aos indicadores submetidos.",
    "",
    "FORMATO POR SECÇÃO",
    "- title: 5-12 palavras.",
    "- narrative: 2-4 frases (40-800 caracteres).",
    "- callouts: 0-4 destaques curtos (números concretos do perfil).",
  ].join("\n"),
  buildUserMessage: (input) => [
    {
      type: "text",
      text:
        `Template: ${input.template}\n` +
        `Período: ${input.period.start} → ${input.period.end}\n\n` +
        `Perfil:\n${JSON.stringify(input.profile, null, 2)}\n\n` +
        `Emissões:\n${JSON.stringify(input.emissions, null, 2)}\n\n` +
        `Cobertura:\n${JSON.stringify(input.coverage, null, 2)}\n\n` +
        `Registos:\n${JSON.stringify(input.recordCountsByTemplate, null, 2)}\n\n` +
        `Gera o resumo executivo.`,
    },
  ],
  // 3-6 sections × ~250 tokens = ~1500 tokens. Cap at 4K to leave
  // headroom for verbose pt-PT prose.
  maxTokens: 4096,
});
