import { EmptyState } from "@/components/shell/EmptyState";
import { PageHeader } from "@/components/shell/PageHeader";
import { fetchMe, fetchMyRecords, fetchTemplates } from "@/lib/api-client";
import type { Record as BgRecord } from "@bgreen/types";
import { Add, ArrowRight, Document } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RecordsListView } from "./RecordsListView";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

type TagType = "cool-gray" | "blue" | "green" | "magenta" | "red";
const statusTagType: Record<string, TagType> = {
  draft: "cool-gray",
  submitted: "blue",
  approved: "green",
  changes_requested: "magenta",
  rejected: "red",
};

export default async function RecordsListPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, records, templates] = await Promise.all([
    fetchMe(),
    fetchMyRecords(),
    fetchTemplates(),
  ]);
  const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
  const publishedTemplates = templates.filter((t) => t.status === "published");
  const isAdmin = me?.activeOrganizationRole === "org_admin";

  const pending = isAdmin ? records.filter((r) => r.status === "submitted") : [];
  const others = isAdmin ? records.filter((r) => r.status !== "submitted") : records;

  const rows = (list: BgRecord[]) =>
    list.map((r) => ({
      id: r.id,
      template: templateNameById.get(r.templateId) ?? "(modelo removido)",
      status: r.status,
      statusLabel: statusLabel[r.status] ?? r.status,
      statusType: statusTagType[r.status] ?? "cool-gray",
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toLocaleString("pt-PT") : "—",
      continueLabel:
        r.status === "draft" || r.status === "changes_requested" ? "Continuar" : "Ver",
    }));

  const hasAnyRecord = records.length > 0;

  return (
    <>
      <PageHeader
        title={isAdmin ? "Registos da organização" : "Os meus registos"}
        description={
          isAdmin
            ? "Submissões da organização. Reveja, aprove ou peça alterações."
            : "Os seus rascunhos, submissões e aprovações."
        }
        icon={Document}
      />
      <div className="space-y-8 px-8 py-6">
        {publishedTemplates.length > 0 && (
          <section>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Submeter novo registo
            </p>
            <div className="flex flex-wrap gap-2">
              {publishedTemplates.map((tpl) => (
                <Link
                  key={tpl.id}
                  href={`/records/new?template=${tpl.id}`}
                  className="cds--btn cds--btn--tertiary cds--layout--size-md"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Add />
                  {tpl.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {!hasAnyRecord ? (
          <EmptyState
            title="Sem registos ainda"
            description={
              isAdmin
                ? "Quando os membros submeterem registos, aparecerão aqui."
                : "Submeta um novo registo para começar a ver indicadores no painel."
            }
            primaryAction={
              publishedTemplates[0]
                ? {
                    label: `Submeter ${publishedTemplates[0].name}`,
                    href: `/records/new?template=${publishedTemplates[0].id}`,
                    icon: Add,
                  }
                : undefined
            }
            secondaryAction={{
              label: "Ver modelos",
              href: "/templates",
              icon: ArrowRight,
            }}
          />
        ) : (
          <RecordsListView
            isAdmin={isAdmin}
            pending={rows(pending)}
            others={rows(others)}
          />
        )}
      </div>
    </>
  );
}
