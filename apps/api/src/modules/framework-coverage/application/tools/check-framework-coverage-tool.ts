// checkFrameworkCoverage — V10.3 AI explanation pass over a
// deterministic coverage matrix. Status comes from CoverageCalculator;
// this tool adds plain-language explanation + suggested next step per
// datapoint row.
//
// Design choices (V10 plan §criteria + V10 open questions):
//   - The model receives the *already-computed* status. It never
//     decides status — that's deterministic per CoverageCalculator.
//     Schema enforces echoing the input status verbatim so the route
//     can guard against drift (V9's mode-mismatch pattern).
//   - No regulatory citations beyond the framework's own code (E1-6,
//     Scope 1, 305-1). v1 takes the same anti-hallucination posture
//     as the V9 recommendations tool: model writes narrative, not
//     legal references.
//   - pt-PT only. The @bgreen/ai PT_PT_SYSTEM_PREFIX covers the
//     baseline; the tool's system prompt restates it for belt-and-
//     suspenders.

import { defineAiTool } from "@bgreen/ai";
import { z } from "zod";

const frameworkSchema = z.enum(["esrs", "ghg", "gri"]);
const statusSchema = z.enum(["covered", "partial", "missing"]);

// What the AI sees per datapoint. The id round-trips so we can merge
// the explanations back onto the deterministic matrix without
// re-aligning by index.
const coverageRowSummarySchema = z.object({
  datapointId: z.string().min(1).max(128),
  // Framework-issued code, surfaced verbatim in the explanation if
  // the model wants ("E1-6 aplica-se porque..."). 8-64 chars.
  code: z.string().min(1).max(64),
  topic: z.string().min(1).max(32),
  title: z.string().min(1).max(200),
  status: statusSchema,
  applicable: z.boolean(),
});

const profileSnapshotSchema = z.object({
  // Self-reported (V3) or confirmed (V7) size band.
  size: z.enum(["micro", "pequena", "media", "grande"]).nullable(),
  cae3: z.string().nullable(),
  dimensao: z.enum(["micro", "pequena", "media", "grande"]).nullable(),
});

export const checkFrameworkCoverageInputSchema = z.object({
  framework: frameworkSchema,
  profile: profileSnapshotSchema,
  // The full matrix. Limited to 60 rows — V10.1 ESRS E1 has 30, GHG
  // 15, GRI 20; the cap is well above the realistic upper bound and
  // gives V11+ room to grow.
  coverageRows: z.array(coverageRowSummarySchema).min(1).max(60),
});

export type CheckFrameworkCoverageInput = z.infer<typeof checkFrameworkCoverageInputSchema>;

const explanationSchema = z.object({
  datapointId: z.string().min(1).max(128),
  // Echo back the status so we can validate the model didn't silently
  // flip it. Drift → drop the explanation rather than persisting a
  // status that disagrees with CoverageCalculator.
  status: statusSchema,
  // 2-3 pt-PT sentences explaining why this datapoint is covered,
  // partial, or missing — cites the org's CAE-3 or dimensao when
  // relevant ("a vossa CAE-3 = 351 está no âmbito do CELE...").
  explanation: z.string().min(30).max(600),
  // 1-2 sentences. For missing: how to start collecting. For partial:
  // what record to submit. For covered: validation or audit-readiness
  // tip.
  suggestedNextStep: z.string().min(20).max(400),
});

export const checkFrameworkCoverageOutputSchema = z.object({
  explanations: z.array(explanationSchema).min(1).max(60),
});

export type CheckFrameworkCoverageOutput = z.infer<
  typeof checkFrameworkCoverageOutputSchema
>;

export const checkFrameworkCoverageTool = defineAiTool({
  name: "check_framework_coverage",
  description:
    "Explica em pt-PT, para cada datapoint de um framework ESG (ESRS / GHG / GRI), " +
    "porque está coberto, parcial ou em falta, citando o setor e dimensão da empresa. " +
    "Sugere o próximo passo concreto.",
  inputSchema: checkFrameworkCoverageInputSchema,
  outputSchema: checkFrameworkCoverageOutputSchema,
  systemPrompt: [
    "És o motor de cobertura regulamentar do bGreen. Para cada datapoint recebido geras uma explicação e um próximo passo.",
    "",
    "ENTRADA",
    "Recebes:",
    "- framework: esrs | ghg | gri.",
    "- profile: tamanho, CAE-3, dimensão da empresa.",
    "- coverageRows: lista de datapoints já classificados como 'covered' / 'partial' / 'missing' / 'applicable: bool'.",
    "",
    "REGRAS",
    "- Não alteras o status — devolves-o exatamente como o recebeste.",
    "- Toda a resposta em pt-PT (português europeu).",
    "- Cita CAE-3 e dimensão quando ajudam a justificar a aplicabilidade ('CAE-3 = 351 está no âmbito CELE/EU ETS').",
    "- NÃO citas artigos específicos de regulamentos (CSRD, ESRS, etc.) — usas apenas o código emitido pelo próprio framework (ex.: E1-6, Scope 1, 305-1).",
    "- NÃO promoves produtos ou marcas.",
    "",
    "TOM POR ESTADO",
    "- covered → confirmação curta + dica de auditoria / validação dos dados.",
    "- partial → reconhecer o modelo já existente + pedir submissão de registo concreto.",
    "- missing → explicar a aplicabilidade + sugerir o primeiro passo (que modelo criar, que dados recolher).",
    "",
    "FORMATO",
    "- Uma entrada por datapoint, na mesma ordem.",
    "- explanation: 2-3 frases.",
    "- suggestedNextStep: 1-2 frases concretas e accionáveis.",
  ].join("\n"),
  buildUserMessage: (input) => [
    {
      type: "text",
      text:
        `Framework: ${input.framework}\n` +
        `Perfil:\n${JSON.stringify(input.profile, null, 2)}\n\n` +
        `Datapoints:\n${JSON.stringify(input.coverageRows, null, 2)}\n\n` +
        `Gera uma explicação + próximo passo para cada datapoint.`,
    },
  ],
  // Output scales with rows. 60 rows × ~150 tokens per explanation ≈
  // 9K tokens. Cap at 12K to leave headroom for verbose narrative.
  maxTokens: 12_000,
});
