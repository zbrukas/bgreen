import type { AuditEntityKind, AuditEvent, NewAuditEvent } from "../domain/audit-event.js";

export interface AuditRepository {
  insert(input: NewAuditEvent): Promise<AuditEvent>;
  listForEntity(
    organizationId: string,
    entityKind: AuditEntityKind,
    entityId: string,
  ): Promise<AuditEvent[]>;
}

// Thin orchestrator. The point of this class is to give callers a single
// `record(...)` method and to expose a clean read API for the history view.
// Pure payload construction lives in AuditWriter (domain).
export class AuditService {
  constructor(private readonly repo: AuditRepository) {}

  record<Payload>(event: NewAuditEvent<Payload>): Promise<AuditEvent<Payload>> {
    return this.repo.insert(event) as Promise<AuditEvent<Payload>>;
  }

  listForEntity(
    organizationId: string,
    entityKind: AuditEntityKind,
    entityId: string,
  ): Promise<AuditEvent[]> {
    return this.repo.listForEntity(organizationId, entityKind, entityId);
  }
}
