import { PageHeader } from "@bgreen/ui";
import { fetchCsDomains, fetchMe } from "@/lib/api-client";
import { CsDomainListOptionsSchema } from "@bgreen/types";
import { Globe } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { AddDomainForm } from "./AddDomainForm";
import { DomainsTable } from "./DomainsTable";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CsDomainsPage({ searchParams }: PageProps) {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const canEdit = me.centralServicesRole === "admin";
  const raw = await searchParams;
  const parsed = CsDomainListOptionsSchema.safeParse(raw);
  const options = parsed.success ? parsed.data : {};
  const pageSize = options.pageSize ?? 10;
  const page = options.page ?? 1;
  const { items: domains, total } = await fetchCsDomains({ ...options, page, pageSize });

  return (
    <>
      <PageHeader
        title="Domínios CS"
        description="Domínios cujos sign-ups são automaticamente classificados como utilizadores Central Services."
        icon={Globe}
      />
      <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {canEdit && <AddDomainForm />}
        <DomainsTable
          domains={domains.map((d) => ({
            id: d.id,
            domain: d.domain,
            note: d.note,
            createdAt: d.createdAt,
          }))}
          canEdit={canEdit}
          totalItems={total}
          page={page}
          pageSize={pageSize}
        />
      </div>
    </>
  );
}
