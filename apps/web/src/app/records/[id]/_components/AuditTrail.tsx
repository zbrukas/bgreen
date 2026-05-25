import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { type AuditEntityKind, type AuditEvent, fetchAuditTrail } from "@/lib/api-client";

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
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-3">
          {events.map((event) => (
            <li key={event.id} className="border-l-2 border-muted pl-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm font-medium">
                  {actionLabel[event.action] ?? event.action}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={event.occurredAt}>
                  {new Date(event.occurredAt).toLocaleString("pt-PT")}
                </time>
              </div>
              <AuditPayload event={event} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function AuditPayload({ event }: { event: AuditEvent }) {
  const payload = event.payload as Record<string, unknown> | null;
  if (!payload || typeof payload !== "object") return null;

  // Workflow / review actions surface human-readable lines.
  if (typeof payload.fromStatus === "string" && typeof payload.toStatus === "string") {
    return (
      <p className="text-xs text-muted-foreground">
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

  // Default: stringify changed-fields hint if present.
  if (Array.isArray(payload.changedFields) && payload.changedFields.length > 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Campos alterados: {payload.changedFields.join(", ")}
      </p>
    );
  }
  return null;
}
