import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { fetchCsInbox, fetchMe } from "@/lib/api-client";
import { Document, Notification as NotificationIcon } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { InboxTable } from "./InboxTable";

export const dynamic = "force-dynamic";

export default async function CsInboxPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const inbox = await fetchCsInbox();

  const rows = inbox.map((instance) => ({
    id: instance.id,
    entityId: instance.entityId,
    state: typeof instance.currentState === "string" ? instance.currentState : "—",
    updatedAt: new Date(instance.updatedAt).toLocaleString("pt-PT"),
  }));

  return (
    <>
      <PageHeader
        title="Revisão"
        description="Registos submetidos pelas organizações a aguardar decisão."
        icon={NotificationIcon}
      />
      <div className="space-y-6 px-8 py-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Sem submissões pendentes"
            description="Quando organizações submeterem registos, aparecerão aqui."
            primaryAction={{ label: "Ver modelos", href: "/templates", icon: Document }}
          />
        ) : (
          <InboxTable rows={rows} />
        )}
      </div>
    </>
  );
}
