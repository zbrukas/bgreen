// extractEconomicProfile — pull structured economic data out of an IES PDF.
//
// PRD #19 §17–18: the model returns {value, confidence} per field. Confidence
// reflects whether the model is sure about its reading (legible, formatted
// as expected) vs. unsure (column layout broken, scan artifact, value
// inferred). The downstream PerfilEconomicoValidator further downgrades
// confidence when the value violates deterministic sanity checks.
//
// Values may legitimately be null when the field is missing from the PDF
// — IES filings sometimes omit balance sheet detail. The validator flags
// missing required fields separately.

import { defineAiTool } from "@bgreen/ai";
import { z } from "zod";

const confidenceSchema = z.enum(["HIGH", "MEDIUM", "LOW"]);

// `value: T | null` so the model can signal "not present in this PDF"
// without inventing a number. We keep value separate from confidence so
// the validator can downgrade confidence without losing the original
// number.
const extractedNumberFieldSchema = z.object({
  value: z.number().nullable(),
  confidence: confidenceSchema,
});

const extractedStringFieldSchema = z.object({
  value: z.string().nullable(),
  confidence: confidenceSchema,
});

export const extractEconomicProfileInputSchema = z.object({
  pdfBase64: z.string().min(1),
});

export type ExtractEconomicProfileInput = z.infer<typeof extractEconomicProfileInputSchema>;

export const extractEconomicProfileOutputSchema = z.object({
  year: extractedNumberFieldSchema,
  employees: extractedNumberFieldSchema,
  // All amounts are in EUR (no cents in the model output — the IES presents
  // them as whole-euro values in most filings).
  turnover: extractedNumberFieldSchema,
  ebitda: extractedNumberFieldSchema,
  balanceSheetTotal: extractedNumberFieldSchema,
  // CAE Rev.3 code, 5-digit string (e.g., "62010"). The model may return
  // shorter (3-digit sector) or with dots — we let it through; downstream
  // normalisation happens at confirmation time (V6.4).
  cae: extractedStringFieldSchema,
});

export type ExtractEconomicProfileOutput = z.infer<typeof extractEconomicProfileOutputSchema>;

export const extractEconomicProfileTool = defineAiTool({
  name: "extract_economic_profile",
  description:
    "Extrai os campos económicos chave de uma Informação Empresarial Simplificada " +
    "(IES) portuguesa. Para cada campo devolve o valor e o nível de confiança. " +
    "Valores em EUR. Devolve null em vez de inventar valores quando o campo está " +
    "ausente.",
  inputSchema: extractEconomicProfileInputSchema,
  outputSchema: extractEconomicProfileOutputSchema,
  systemPrompt: [
    "És um extrator especializado de dados financeiros de IES portuguesas (anexo A — empresas).",
    "",
    "Para cada campo, devolve:",
    "- value: o número (ou string para o CAE) lido do documento. Null se o campo não estiver presente.",
    "- confidence: HIGH se a leitura é inequívoca; MEDIUM se há ambiguidade (formato, layout);",
    "  LOW se o valor é inferido ou pouco claro.",
    "",
    "Notas:",
    "- Year: ano de exercício a que a IES se refere.",
    "- Employees: número médio de trabalhadores no ano. Procura tipicamente em 'Pessoal'.",
    "- Turnover: 'Volume de negócios' (vendas + prestação de serviços). Não é o total de proveitos.",
    "- EBITDA: lucro antes de juros, impostos, depreciação e amortização. Pode estar etiquetado",
    "  'Resultado antes de depreciações, gastos de financiamento e impostos' ou ser calculado.",
    "  Pode ser negativo.",
    "- Balance sheet total: 'Total do Ativo' do balanço. Sempre não-negativo.",
    "- CAE: código CAE Rev.3 principal da empresa (5 dígitos, podem aparecer com pontos).",
    "",
    "Não inventes valores. Se um campo está ausente, devolve value=null com confidence=LOW.",
  ].join("\n"),
  buildUserMessage: (input) => [
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 },
    },
    {
      type: "text",
      text: "Extrai os campos económicos desta IES.",
    },
  ],
  // Structured output is small (six fields × two properties); 1024 leaves
  // room for the model's tool_use envelope without truncation.
  maxTokens: 1024,
});
