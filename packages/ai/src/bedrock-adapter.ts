// Bedrock EU adapter — scaffolded but disabled.
//
// PRD §AI plumbing: "Anthropic direct + signed DPA. Bedrock EU adapter
// scaffolded but disabled (one env var to flip)." V6 acceptance criteria:
// "Bedrock EU adapter scaffolded but disabled (one env var + one file to
// flip). Confirmed not in code path."
//
// To enable Bedrock EU when a customer requires it:
//   1) Install @anthropic-ai/bedrock-sdk and aws-sdk dependencies.
//   2) Replace `bedrockMessagesClient()` below with a real implementation
//      that builds an AnthropicBedrock client and adapts its `messages`.
//   3) Set BGREEN_AI_TRANSPORT=bedrock in the deploy env. AnthropicAiClient
//      (or the wiring in apps/api) will check that flag and use this
//      factory instead of the direct Anthropic constructor.
//
// Until then the flag is unread and this module re-exports nothing the rest
// of @bgreen/ai imports — keeping it out of the active code path.

import type { MessagesClient } from "./client";

export type AiTransport = "anthropic" | "bedrock";

export function resolveTransport(): AiTransport {
  return process.env.BGREEN_AI_TRANSPORT === "bedrock" ? "bedrock" : "anthropic";
}

// Placeholder. Throws if `BGREEN_AI_TRANSPORT=bedrock` is set without first
// swapping in the real implementation — fails loudly at boot rather than
// silently routing to the wrong provider.
export function bedrockMessagesClient(): MessagesClient {
  throw new Error(
    "Bedrock EU transport is scaffolded but not implemented. " +
      "See packages/ai/src/bedrock-adapter.ts to enable it.",
  );
}
