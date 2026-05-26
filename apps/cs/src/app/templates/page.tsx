import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { fetchMe, fetchTemplates } from "@/lib/api-client";
import { Add, Document } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { TemplatesHeaderActions } from "./TemplatesHeaderActions";
import { TemplatesTable } from "./TemplatesTable";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

type TagType = "cool-gray" | "green" | "warm-gray";
const statusType: Record<string, TagType> = {
  draft: "cool-gray",
  published: "green",
  archived: "warm-gray",
};

export default async function CsTemplatesListPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const templates = await fetchTemplates();

  const rows = templates.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    status: tpl.status,
    statusLabel: statusLabel[tpl.status] ?? tpl.status,
    statusType: statusType[tpl.status] ?? "cool-gray",
    isSubTemplate: tpl.isSubTemplate,
    fieldCount: tpl.formSchema.rows.reduce((n, r) => n + r.fields.length, 0),
  }));

  return (
    <>
      <PageHeader
        title="Modelos"
        description="Catálogo de modelos de registo. Crie, edite e publique para uso pelas organizações."
        icon={Document}
        actions={<TemplatesHeaderActions />}
      />
      <div className="space-y-6 px-8 py-6">
        {rows.length === 0 ? (
          <EmptyState
            title="Sem modelos no catálogo"
            description="Crie o primeiro modelo para começar a recolher dados ESG."
            primaryAction={{ label: "Novo modelo", href: "/templates/new" }}
            primaryIcon={Add}
          />
        ) : (
          <TemplatesTable rows={rows} />
        )}
      </div>
    </>
  );
}
