import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { fetchInbox, fetchMyRecords, fetchTemplates } from "@/lib/api-client";
import { ArrowRight, Notification as NotificationIcon } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { InboxTable } from "./InboxTable";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, string> = {
  draft: "Rascunho — preencher",
  changes_requested: "Alterações pedidas — corrigir",
};

type TagType = "cool-gray" | "magenta";
const stateTagType: Record<string, TagType> = {
  draft: "cool-gray",
  changes_requested: "magenta",
};

export default async function InboxPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [inbox, templates, records] = await Promise.all([
    fetchInbox(),
    fetchTemplates(),
    fetchMyRecords(),
  ]);
  const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
  // Map record-id → template-name via the record's templateId. Records the
  // user can't see (admins see all, members see only own) just render
  // "Registo" instead of a template name.
  const templateNameByRecord = new Map(
    records.map((r) => [r.id, templateNameById.get(r.templateId) ?? "Registo"]),
  );

  const rows = inbox.map((instance) => {
    const state = typeof instance.currentState === "string" ? instance.currentState : "—";
    return {
      id: instance.id,
      recordId: instance.entityId,
      template: templateNameByRecord.get(instance.entityId) ?? "Registo",
      state,
      stateLabel: stateLabel[state] ?? state,
      stateType: stateTagType[state] ?? "cool-gray",
      updatedAt: new Date(instance.updatedAt).toLocaleString("pt-PT"),
    };
  });

  return (
    <>
      <PageHeader
        title="Pendentes"
        description="Rascunhos e registos com alterações pedidas a aguardar a sua resposta. A revisão é feita pelos serviços centrais."
        icon={NotificationIcon}
      />
      <div className="space-y-8 px-8 py-8">
        {rows.length === 0 ? (
          <EmptyState
            title="Nada pendente"
            description="Quando tiver rascunhos ou registos com alterações pedidas, aparecerão aqui."
            primaryAction={{ label: "Ver todos os registos", href: "/records" }}
            primaryIcon={<ArrowRight />}
          />
        ) : (
          <InboxTable rows={rows} />
        )}
      </div>
    </>
  );
}
