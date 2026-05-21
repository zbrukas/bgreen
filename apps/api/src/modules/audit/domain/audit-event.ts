// AuditEvent — the value persisted on `audit_log`. Generic over the
// payload so callers can keep their own typed shapes; the service stores
// whatever JSON-serialisable thing it receives.

export type AuditEntityKind =
  | "record"
  | "record_template"
  | "organization"
  | "organization_invite"
  | "workflow_instance";

export interface AuditEvent<Payload = unknown> {
  id: string;
  occurredAt: string;
  actorUserId: string | null;
  organizationId: string;
  entityKind: AuditEntityKind;
  entityId: string;
  action: string;
  payload: Payload;
  correlationId: string | null;
}

export interface NewAuditEvent<Payload = unknown> {
  actorUserId: string | null;
  organizationId: string;
  entityKind: AuditEntityKind;
  entityId: string;
  action: string;
  payload: Payload;
  correlationId?: string | null;
}
