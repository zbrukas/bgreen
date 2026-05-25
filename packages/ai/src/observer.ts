// Per-call observer hook. Wired in apps/api to write `ai.tool_call` audit
// rows + emit PostHog events without each caller wrapping the call.
//
// Fires for every `client.call()` attempt — including input-validation
// failures (latencyMs=0). One AiCallObservation per attempt. Errors thrown
// from inside the observer are swallowed by the client so audit failure
// doesn't break extraction.

import type { AiErrorKind } from "./errors";

export interface AiCallContext {
  // Tenant scope. Required for the audit observer to write a properly
  // scoped audit_log row.
  organizationId?: string;
  // Acting user, if any. Null for system-initiated calls (e.g., an
  // Inngest function running with no user in the loop yet).
  actorUserId?: string | null;
  // Groups multiple AI calls in one logical operation (e.g., classify +
  // extract for one IES upload). Becomes audit_log.correlation_id.
  correlationId?: string;
  // Free-form metadata for the observer. Not used by the client itself.
  metadata?: Record<string, unknown>;
}

export interface AiTokenUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
}

export interface AiCallObservation {
  toolName: string;
  // Discriminator. Observers branch on this to write success vs failure.
  outcome: "ok" | "error";
  // Populated when outcome === "error". Lets observers distinguish
  // transient (worth alerting) from input_validation (programmer error).
  errorKind?: AiErrorKind;
  // Wall-clock duration of the SDK call. Zero for failures before the
  // SDK was invoked (input_validation, schema conversion).
  latencyMs: number;
  // Null when the call never reached the SDK or the SDK didn't return
  // usage (e.g., transient connection error).
  usage: AiTokenUsage | null;
  // Echoed back from the call site for the observer's bookkeeping.
  context: AiCallContext;
}

export type AiCallObserver = (observation: AiCallObservation) => void | Promise<void>;

// Chain multiple observers behind the single observer hook on
// AnthropicAiClient. Each runs in order; one observer's exception does
// NOT prevent the others from firing (so an audit-write failure
// doesn't drop the PostHog event, and vice versa). Each observer also
// awaits independently — a slow observer can't stall the others.
export function composeObservers(observers: AiCallObserver[]): AiCallObserver {
  return async (observation) => {
    // Run in parallel; collect outcomes via allSettled so a rejected
    // promise from one observer never reaches the AnthropicAiClient
    // (which swallows observer errors at the top level too, but we
    // localise the isolation here for clarity).
    //
    // The async-wrapper IIFE catches *synchronous* throws as well — a
    // bare `obs(observation)` that throws synchronously would escape
    // Promise.resolve and break the map call.
    await Promise.allSettled(
      observers.map(async (obs) => {
        await obs(observation);
      }),
    );
  };
}
