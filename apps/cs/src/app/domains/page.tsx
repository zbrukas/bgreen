import { PageHeader } from "@/components/shell/PageHeader";
import { fetchCsDomains, fetchMe } from "@/lib/api-client";
import { Globe } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { AddDomainForm } from "./AddDomainForm";
import { DomainsTable } from "./DomainsTable";

export const dynamic = "force-dynamic";

export default async function CsDomainsPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const canEdit = me.centralServicesRole === "admin";
  const domains = await fetchCsDomains();

  return (
    <>
      <PageHeader
        title="Domínios CS"
        description="Domínios cujos sign-ups são automaticamente classificados como utilizadores Central Services."
        icon={Globe}
      />
      <div className="space-y-6 px-8 py-6">
        {canEdit && <AddDomainForm />}
        <DomainsTable
          domains={domains.map((d) => ({
            id: d.id,
            domain: d.domain,
            note: d.note,
            createdAt: d.createdAt,
          }))}
          canEdit={canEdit}
        />
      </div>
    </>
  );
}
