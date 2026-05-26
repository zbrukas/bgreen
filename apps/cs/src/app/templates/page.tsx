import { EmptyState } from "@bgreen/ui";
import { PageHeader } from "@bgreen/ui";
import { fetchMe, fetchTemplates } from "@/lib/api-client";
import { Add, Document } from "@carbon/icons-react";
import { RecordTemplateListOptionsSchema } from "@bgreen/types";
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

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CsTemplatesListPage({ searchParams }: PageProps) {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const raw = await searchParams;
  // safeParse so invalid params don't 500 — they just fall back to defaults.
  const parsed = RecordTemplateListOptionsSchema.safeParse(raw);
  const options = parsed.success ? parsed.data : {};
  // Default pageSize=10 in the URL is implicit; we force it here so the
  // API paginates instead of returning everything.
  const pageSize = options.pageSize ?? 10;
  const page = options.page ?? 1;
  const { items: templates, total } = await fetchTemplates({ ...options, page, pageSize });

  const hasActiveFilters = Boolean(
    options.q || options.status || options.sub || options.sort,
  );

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
      <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {total === 0 && !hasActiveFilters ? (
          <EmptyState
            title="Sem modelos no catálogo"
            description="Crie o primeiro modelo para começar a recolher dados ESG."
            primaryAction={{ label: "Novo modelo", href: "/templates/new" }}
            primaryIcon={<Add />}
          />
        ) : (
          <TemplatesTable rows={rows} totalItems={total} page={page} pageSize={pageSize} />
        )}
      </div>
    </>
  );
}
