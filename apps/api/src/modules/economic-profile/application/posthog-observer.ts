// AiCallObserver implementation that emits an `ai.tool_call` event to
// PostHog per AnthropicAiClient.call() attempt.
//
// Pairs with createAiToolCallObserver (audit-observer.ts) under a single
// composeObservers([...]) hook on the client. Keeps the two telemetry
// surfaces decoupled: audit_log is the regulated record, PostHog is the
// product-analytics surface.
//
// Cost approximation uses a hard-coded price table per the V6 plan
// acceptance criteria ("token cost approximation"). Promote to a config
// table when a second model joins the registry (V7+).

import type { AiCallObservation, AiCallObserver } from "@bgreen/ai";
import type { PostHogTelemetry } from "../../../telemetry/posthog.js";

// Per-million-token pricing in USD. Mirrors the public Anthropic pricing
// at V6 launch. Cache reads / writes priced per `prompt-caching` doc:
//   - cache writes: 1.25× base input price (5m TTL)
//   - cache reads: ~0.1× base input price
// We approximate — exact bill comes from Anthropic's invoice.
interface ModelPrices {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICES: Record<string, ModelPrices> = {
  "claude-sonnet-4-6": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-opus-4-7": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-opus-4-6": { inputPerMillion: 5, outputPerMillion: 25 },
  "claude-haiku-4-5": { inputPerMillion: 1, outputPerMillion: 5 },
};

// Default to Sonnet 4.6 since that's bGreen's default model.
const DEFAULT_MODEL = "claude-sonnet-4-6";

function approximateCostUsd(model: string, usage: AiCallObservation["usage"]): number | null {
  if (!usage) return null;
  const prices = PRICES[model] ?? PRICES[DEFAULT_MODEL];
  if (!prices) return null;
  const input = usage.inputTokens ?? 0;
  const output = usage.outputTokens ?? 0;
  // Cache writes priced at 1.25×, cache reads at 0.1×.
  const cacheCreate = usage.cacheCreationInputTokens ?? 0;
  const cacheRead = usage.cacheReadInputTokens ?? 0;
  const cost =
    (input * prices.inputPerMillion) / 1_000_000 +
    (output * prices.outputPerMillion) / 1_000_000 +
    (cacheCreate * prices.inputPerMillion * 1.25) / 1_000_000 +
    (cacheRead * prices.inputPerMillion * 0.1) / 1_000_000;
  return cost;
}

export function createAiToolCallPostHogObserver(
  telemetry: PostHogTelemetry,
  options: { model?: string } = {},
): AiCallObserver {
  const model = options.model ?? DEFAULT_MODEL;
  return (obs) => {
    const distinctId = obs.context.actorUserId ?? `org:${obs.context.organizationId ?? "unknown"}`;
    telemetry.capture({
      distinctId,
      event: "ai.tool_call",
      properties: {
        tool_name: obs.toolName,
        outcome: obs.outcome,
        error_kind: obs.errorKind ?? null,
        latency_ms: obs.latencyMs,
        input_tokens: obs.usage?.inputTokens ?? null,
        output_tokens: obs.usage?.outputTokens ?? null,
        cache_creation_input_tokens: obs.usage?.cacheCreationInputTokens ?? null,
        cache_read_input_tokens: obs.usage?.cacheReadInputTokens ?? null,
        approximate_cost_usd: approximateCostUsd(model, obs.usage),
        correlation_id: obs.context.correlationId ?? null,
        // Pass-through metadata from the call site (e.g., feature flag).
        ...(obs.context.metadata ?? {}),
      },
      // Group analytics by org. PostHog "company" group type matches the
      // existing PostHog setup; the project's group_types include
      // "company". Distinct ID stays per-user.
      groups: obs.context.organizationId ? { company: obs.context.organizationId } : undefined,
    });
  };
}
