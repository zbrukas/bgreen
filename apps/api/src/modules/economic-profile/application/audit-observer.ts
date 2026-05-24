// AiCallObserver implementation that writes `ai.tool_call` audit rows.
//
// Wired into AnthropicAiClient at boot (services.ts). Fires for every
// `client.call()` attempt. The observation's `context.correlationId`
// groups multiple calls in one logical operation (one IES extraction
// fires both classifyDocument and extractEconomicProfile against the
// same correlation id).
//
// Skips audit when `context.organizationId` is absent — every audit row
// is org-scoped, so a call with no org context (boot-time eval, future
// admin tooling) isn't auditable here. Callers that need to audit must
// pass organizationId; not doing so is silent, deliberate opt-out.

import type { AiCallObservation, AiCallObserver } from "@bgreen/ai";
import type { AuditService } from "../../audit/module.js";

interface AiToolCallPayload {
  outcome: "ok" | "error";
  errorKind?: string;
  latencyMs: number;
  usage: AiCallObservation["usage"];
  // Pass-through metadata from the call site (e.g., feature flag).
  metadata?: Record<string, unknown>;
}

export function createAiToolCallObserver(auditService: AuditService): AiCallObserver {
  return async (obs) => {
    const orgId = obs.context.organizationId;
    if (!orgId) return;
    // entityId is the correlationId — for IES extraction that's the
    // extraction log id. Falling back to a synthesised id when no
    // correlation was passed keeps the row valid (the audit_log row
    // still gets written; it's just not joinable to a domain entity).
    const entityId = obs.context.correlationId ?? crypto.randomUUID();
    const payload: AiToolCallPayload = {
      outcome: obs.outcome,
      errorKind: obs.errorKind,
      latencyMs: obs.latencyMs,
      usage: obs.usage,
      metadata: obs.context.metadata,
    };
    await auditService.record<AiToolCallPayload>({
      actorUserId: obs.context.actorUserId ?? null,
      organizationId: orgId,
      // For V6.3 every AI call originates from IES extraction. V8+ adds
      // recommendations, which will set their own entityKind (e.g.,
      // 'generated_recommendation') in their own correlation context.
      entityKind: "ies_extraction",
      entityId,
      action: `ai.tool_call.${obs.toolName}`,
      payload,
      correlationId: obs.context.correlationId ?? null,
    });
  };
}
