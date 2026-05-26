import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { fetchTemplates } from "@/lib/api-client";
import { Document } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
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

export default async function TemplatesListPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const templates = await fetchTemplates();
  const published = templates.filter((t) => t.status === "published");

  const rows = published.map((tpl) => ({
    id: tpl.id,
    name: tpl.name,
    status: tpl.status,
    statusLabel: statusLabel[tpl.status] ?? tpl.status,
    statusType: statusType[tpl.status] ?? "cool-gray",
    fieldCount: tpl.formSchema.rows.reduce((n, r) => n + r.fields.length, 0),
  }));

  return (
    <>
      <PageHeader
        title="Catálogo de modelos"
        description="Modelos publicados pelos serviços centrais. Para criar ou editar, contacte os serviços centrais."
        icon={Document}
      />
      <div className="space-y-8 px-8 py-8">
        {rows.length === 0 ? (
          <EmptyState
            title="Ainda não existem modelos publicados"
            description="Os serviços centrais ainda não publicaram modelos para a sua organização."
          />
        ) : (
          <TemplatesTable rows={rows} />
        )}
      </div>
    </>
  );
}
