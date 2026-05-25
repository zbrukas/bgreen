import { type AuditEntityKind, type AuditEvent, fetchAuditTrail } from "@/lib/api-client";
import { Tile } from "@carbon/react";

const actionLabel: Record<string, string> = {
  "record.draft_created": "Rascunho criado",
  "record.draft_updated": "Rascunho atualizado",
  "record.submitted": "Submetido para revisão",
  "record.resubmitted": "Reenviado para revisão",
  "record.approve": "Aprovado pelo revisor",
  "record.request_changes": "Alterações pedidas",
  "record.reject": "Rejeitado",
  "template.created": "Modelo criado",
  "template.updated": "Modelo alterado",
  "template.published": "Modelo publicado",
  "template.archived": "Modelo arquivado",
  "organization.created": "Organização criada",
  "invite.created": "Convite criado",
  "invite.accepted": "Convite aceite",
};

export async function AuditTrail({
  entityKind,
  entityId,
}: {
  entityKind: AuditEntityKind;
  entityId: string;
}) {
  const events = await fetchAuditTrail(entityKind, entityId);
  if (events.length === 0) return null;

  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Histórico
      </h2>
      <ol className="mt-4 space-y-3">
        {events.map((event) => (
          <li key={event.id} className="border-l-2 border-neutral-300 pl-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-sm font-medium">
                {actionLabel[event.action] ?? event.action}
              </span>
              <time className="text-xs text-neutral-600" dateTime={event.occurredAt}>
                {new Date(event.occurredAt).toLocaleString("pt-PT")}
              </time>
            </div>
            <AuditPayload event={event} />
          </li>
        ))}
      </ol>
    </Tile>
  );
}

function AuditPayload({ event }: { event: AuditEvent }) {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return null;

  if (typeof payload.fromStatus === "string" && typeof payload.toStatus === "string") {
    return (
      <p className="text-xs text-neutral-600">
        Estado: {payload.fromStatus} → {payload.toStatus}
        {typeof payload.comment === "string" && payload.comment.length > 0 && (
          <>
            <br />
            <span className="italic">Comentário: {payload.comment}</span>
          </>
        )}
      </p>
    );
  }

  if (Array.isArray(payload.changedFields) && payload.changedFields.length > 0) {
    return (
      <p className="text-xs text-neutral-600">
        Campos alterados: {payload.changedFields.join(", ")}
      </p>
    );
  }
  return null;
}
