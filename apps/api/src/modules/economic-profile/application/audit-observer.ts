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
//
// entityKind is resolved from `context.metadata.entityKind` (string).
// V6 IES extraction omits it and falls through to "ies_extraction";
// V9 recommendations pass "generated_recommendation". Adding more
// surfaces is a metadata change, not a code change.

import type { AiCallObservation, AiCallObserver } from "@bgreen/ai";
import type { AuditEntityKind } from "../../audit/domain/audit-event.js";
import type { AuditService } from "../../audit/module.js";

interface AiToolCallPayload {
  outcome: "ok" | "error";
  errorKind?: string;
  latencyMs: number;
  usage: AiCallObservation["usage"];
  // Pass-through metadata from the call site (e.g., feature flag).
  metadata?: Record<string, unknown>;
}

const KNOWN_ENTITY_KINDS: ReadonlySet<AuditEntityKind> = new Set<AuditEntityKind>([
  "record",
  "record_template",
  "organization",
  "organization_invite",
  "workflow_instance",
  "ies_extraction",
  "generated_recommendation",
]);

function resolveEntityKind(metadata: unknown): AuditEntityKind {
  if (metadata && typeof metadata === "object" && "entityKind" in metadata) {
    const raw = (metadata as { entityKind?: unknown }).entityKind;
    if (typeof raw === "string" && KNOWN_ENTITY_KINDS.has(raw as AuditEntityKind)) {
      return raw as AuditEntityKind;
    }
  }
  return "ies_extraction";
}

export function createAiToolCallObserver(auditService: AuditService): AiCallObserver {
  return async (obs) => {
    const orgId = obs.context.organizationId;
    if (!orgId) return;
    // entityId is the correlationId — for IES extraction that's the
    // extraction log id; for recommendations it's the generation id.
    // Falling back to a synthesised id when no correlation was passed
    // keeps the row valid (the audit_log row still gets written; it's
    // just not joinable to a domain entity).
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
      entityKind: resolveEntityKind(obs.context.metadata),
      entityId,
      action: `ai.tool_call.${obs.toolName}`,
      payload,
      correlationId: obs.context.correlationId ?? null,
    });
  };
}
