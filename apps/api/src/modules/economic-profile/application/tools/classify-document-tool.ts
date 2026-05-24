// classifyDocument — pre-flight check on the uploaded PDF.
//
// PRD #19 / V6: a meaningful share of users will upload the wrong file
// (invoice, contract, last year's IES instead of this one's). The model
// returns {kind, confidence}; the orchestrator aborts with a pt-PT error
// when kind !== 'ies', sparing the user a 30s wait to learn they uploaded
// the wrong document.

import { defineAiTool } from "@bgreen/ai";
import { z } from "zod";

export const classifyDocumentInputSchema = z.object({
  // The PDF as base64. Pass small files inline; larger ones still work
  // (Anthropic accepts PDFs up to 32 MB) but our caller-level cap is
  // 25 MB to stay comfortably under.
  pdfBase64: z.string().min(1),
});

export type ClassifyDocumentInput = z.infer<typeof classifyDocumentInputSchema>;

export const classifyDocumentOutputSchema = z.object({
  kind: z.enum(["ies", "invoice", "other"]),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ClassifyDocumentOutput = z.infer<typeof classifyDocumentOutputSchema>;

export const classifyDocumentTool = defineAiTool({
  name: "classify_document",
  description:
    "Classifica um documento PDF carregado por um utilizador. Indica se é um IES " +
    "(Informação Empresarial Simplificada), uma fatura, ou outro tipo. Devolve " +
    "também a confiança da classificação.",
  inputSchema: classifyDocumentInputSchema,
  outputSchema: classifyDocumentOutputSchema,
  systemPrompt:
    "És um classificador especializado em documentos contabilísticos portugueses. " +
    "Lê o documento fornecido e usa o tool 'classify_document' com o resultado. " +
    "Um IES contém tipicamente: identificação da empresa (NIF, denominação social), " +
    "ano de exercício, balanço, demonstração de resultados, e CAE. Uma fatura tem " +
    "comprador, vendedor, IVA, descrição de produtos/serviços. 'other' para tudo o resto.",
  buildUserMessage: (input) => [
    {
      type: "document",
      source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 },
    },
    {
      type: "text",
      text: "Classifica este documento.",
    },
  ],
  // Tiny structured response — classification + confidence.
  maxTokens: 256,
});
