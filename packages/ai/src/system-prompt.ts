// Every Claude call from bGreen carries this prefix. Two jobs:
//   1) Force pt-PT output — UI is pt-PT only in v1; English drift in extracted
//      values would surface to end users.
//   2) Establish the product persona — keeps tone consistent across tools.
//
// The prefix is intentionally short. Tools layer their own systemPrompt on top.

import type Anthropic from "@anthropic-ai/sdk";

export const PT_PT_SYSTEM_PREFIX =
  "Está integrado no bGreen, uma plataforma portuguesa de gestão de dados ESG. " +
  "Responde sempre em português europeu (pt-PT). " +
  "Quando devolves valores extraídos de documentos, mantém a notação portuguesa " +
  "(vírgula decimal, espaço como separador de milhares).";

// Build the `system` field for the Anthropic request. Returns the array form
// so we can attach `cache_control: ephemeral` to the last block — the prefix
// + tool prompt is identical across calls to the same tool, so it caches.
//
// Note: the cacheable-prefix minimum on Sonnet 4.6 is 2048 tokens. Small
// prompts won't actually populate the cache (usage will show
// cache_creation_input_tokens=0). The marker is cheap to set unconditionally;
// it costs nothing when the prefix is too short.
export function buildSystemBlocks(toolSystemPrompt: string): Anthropic.TextBlockParam[] {
  return [
    {
      type: "text",
      text: `${PT_PT_SYSTEM_PREFIX}\n\n${toolSystemPrompt}`,
      cache_control: { type: "ephemeral" },
    },
  ];
}
