// All errors the AI client returns. Mapped from SDK exceptions (which never
// escape the package) and from our own validation layers.

import Anthropic from "@anthropic-ai/sdk";
import type { ZodError } from "zod";

export type AiErrorKind =
  // Input failed the registered tool's inputSchema. Programmer error: the
  // caller passed something that doesn't satisfy what the tool advertises.
  | "input_validation"
  // SDK rejected the request as malformed (400/422). Programmer error in this
  // package — likely a bug in how we built the Anthropic request.
  | "client"
  // Missing/invalid API key (401) or no permission for the model (403).
  // Operational — fix the credential, not the request.
  | "auth"
  // Anthropic rate limit (429), 5xx, 529 overloaded, network error, abort.
  // Retryable. The SDK already retries internally; this surfaces a failure
  // that survived those retries.
  | "transient"
  // Model returned a tool_use block whose `input` field doesn't validate
  // against the tool's outputSchema. Means the model hallucinated a shape
  // we didn't ask for — caller should fall back to manual entry.
  | "output_parse"
  // Model stopped without producing the forced tool_use (e.g., refusal,
  // max_tokens hit before the tool call). Caller should treat as a failure
  // mode equivalent to extraction failed.
  | "no_tool_use"
  // Anything we didn't anticipate. Keeps the union honest.
  | "unknown";

export interface AiError {
  kind: AiErrorKind;
  message: string;
  // Original cause, for logging. Never type-narrowed on by callers — the
  // `kind` field is the contract.
  cause?: unknown;
}

export const aiError = (kind: AiErrorKind, message: string, cause?: unknown): AiError => ({
  kind,
  message,
  cause,
});

export function aiErrorFromZod(zodError: ZodError, kind: "input_validation" | "output_parse"): AiError {
  const first = zodError.issues[0];
  const path = first?.path.join(".") ?? "(root)";
  const message = first?.message ?? "validation failed";
  return aiError(kind, `${path}: ${message}`, zodError);
}

// Translate any thrown value from the Anthropic SDK into the AiError union.
// Lives here (not in client.ts) so the mapping is testable in isolation and
// adding a new SDK error class is a one-file change.
export function aiErrorFromSdkException(thrown: unknown): AiError {
  if (thrown instanceof Anthropic.BadRequestError) {
    return aiError("client", `bad request: ${thrown.message}`, thrown);
  }
  if (thrown instanceof Anthropic.UnprocessableEntityError) {
    return aiError("client", `unprocessable: ${thrown.message}`, thrown);
  }
  if (thrown instanceof Anthropic.AuthenticationError) {
    return aiError("auth", "invalid or missing ANTHROPIC_API_KEY", thrown);
  }
  if (thrown instanceof Anthropic.PermissionDeniedError) {
    return aiError("auth", `permission denied: ${thrown.message}`, thrown);
  }
  if (thrown instanceof Anthropic.RateLimitError) {
    return aiError("transient", "Anthropic rate limit exceeded", thrown);
  }
  if (thrown instanceof Anthropic.InternalServerError) {
    // 529 (overloaded) shares this class in @anthropic-ai/sdk 0.40 — distinguish by status.
    const overloaded = thrown.status === 529;
    return aiError(
      "transient",
      overloaded ? "Anthropic overloaded (529)" : `Anthropic ${thrown.status ?? "5xx"} error`,
      thrown,
    );
  }
  if (thrown instanceof Anthropic.APIConnectionError) {
    return aiError("transient", "network error contacting Anthropic", thrown);
  }
  if (thrown instanceof Anthropic.APIUserAbortError) {
    return aiError("transient", "request aborted", thrown);
  }
  if (thrown instanceof Anthropic.APIError) {
    return aiError("transient", `Anthropic API error: ${thrown.message}`, thrown);
  }
  return aiError("unknown", thrown instanceof Error ? thrown.message : String(thrown), thrown);
}
