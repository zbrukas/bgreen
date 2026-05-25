import { db, orgScope, schema } from "@bgreen/db";
import { and, asc, eq } from "drizzle-orm";
import type { AuditRepository } from "../application/audit-service.js";
import type { AuditEntityKind, AuditEvent, NewAuditEvent } from "../domain/audit-event.js";

function rowToEvent(row: typeof schema.auditLog.$inferSelect): AuditEvent {
  return {
    id: row.id,
    occurredAt: row.occurredAt.toISOString(),
    actorUserId: row.actorUserId,
    organizationId: row.organizationId,
    entityKind: row.entityKind as AuditEntityKind,
    entityId: row.entityId,
    action: row.action,
    payload: row.payload as unknown,
    correlationId: row.correlationId,
  };
}

export class DrizzleAuditRepository implements AuditRepository {
  async insert(input: NewAuditEvent): Promise<AuditEvent> {
    const [row] = await db
      .insert(schema.auditLog)
      .values({
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        entityKind: input.entityKind,
        entityId: input.entityId,
        action: input.action,
        payload: input.payload as object,
        correlationId: input.correlationId ?? null,
      })
      .returning();
    if (!row) throw new Error("insert audit_log: unexpected empty returning() result");
    return rowToEvent(row);
  }

  async listForEntity(
    organizationId: string,
    entityKind: AuditEntityKind,
    entityId: string,
  ): Promise<AuditEvent[]> {
    const rows = await db
      .select()
      .from(schema.auditLog)
      .where(
        and(
          orgScope(schema.auditLog, organizationId),
          eq(schema.auditLog.entityKind, entityKind),
          eq(schema.auditLog.entityId, entityId),
        ),
      )
      .orderBy(asc(schema.auditLog.occurredAt))
      // Defensive cap. Audit trails are usually a handful of events;
      // a long-lived entity could grow unbounded and the route returns
      // them all in one payload. Hard limit avoids a runaway. Cursor
      // pagination lands when the customer-facing screen does.
      .limit(LIST_LIMIT);
    return rows.map(rowToEvent);
  }
}

const LIST_LIMIT = 200;
