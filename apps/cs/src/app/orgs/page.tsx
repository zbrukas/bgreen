import { EmptyState, PageHeader } from "@bgreen/ui";
import { CsOrgListOptionsSchema } from "@bgreen/types";
import { Building } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { fetchCsOrgs, fetchMe } from "@/lib/api-client";
import { OrgsTable } from "./OrgsTable";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function OrgsPage({ searchParams }: PageProps) {
  const me = await fetchMe();
  if (!me) redirect("/login");
  if (me.userType !== "central_services") redirect("/");

  const raw = await searchParams;
  const parsed = CsOrgListOptionsSchema.safeParse(raw);
  const options = parsed.success ? parsed.data : {};
  const hasActiveFilters = Boolean(options.q || options.distrito || options.sort);
  const pageSize = options.pageSize ?? 10;
  const page = options.page ?? 1;

  // Distrito options for the filter come from an unpaginated fetch of
  // every org — we want the dropdown list stable as the user filters or
  // paginates, not narrowed by the current page.
  const [orgsResult, allOrgsResult] = await Promise.all([
    fetchCsOrgs({ ...options, page, pageSize }),
    fetchCsOrgs(),
  ]);
  const distritos = Array.from(
    new Set(
      allOrgsResult.items
        .map((e) => e.organization.distrito)
        .filter((d): d is string => Boolean(d?.trim())),
    ),
  ).sort((a, b) => a.localeCompare(b, "pt-PT"));

  const rows = orgsResult.items.map((entry) => ({
    id: entry.organization.id,
    name: entry.organization.name,
    nif: entry.organization.nif,
    caeCode: entry.organization.caeCode,
    distrito: entry.organization.distrito,
    memberCount: entry.memberCount,
    adminCount: entry.adminCount,
    createdAt: entry.organization.createdAt,
  }));

  return (
    <>
      <PageHeader
        title="Organizações"
        description="Todas as organizações geridas. Clique para ver membros."
        icon={Building}
      />
      <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {orgsResult.total === 0 && !hasActiveFilters ? (
          <EmptyState
            title="Sem organizações"
            description="Nenhuma organização foi criada ainda. Aparecerão aqui assim que existam."
          />
        ) : (
          <OrgsTable
            rows={rows}
            distritos={distritos}
            totalItems={orgsResult.total}
            page={page}
            pageSize={pageSize}
          />
        )}
      </div>
    </>
  );
}
