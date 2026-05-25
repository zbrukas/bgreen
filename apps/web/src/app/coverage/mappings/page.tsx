// V10.4 — CS-only mapping admin page. The route stays accessible to
// any authed user (the page renders a forbidden notice for non-CS),
// matching the "auth at the page boundary; FGA at the action" pattern
// used elsewhere in the app.

import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchTemplates } from "@/lib/api-client";
import { getFrameworkDatapoints, getMappings } from "@/lib/coverage-actions";
import type {
  FrameworkDatapoint,
  TemplateDatapointMapping,
} from "@/lib/coverage-types";
import { Settings } from "@carbon/icons-react";
import { InlineNotification } from "@carbon/react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { MappingsEditor } from "./_components/MappingsEditor";

export const dynamic = "force-dynamic";

export default async function MappingsPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId] = await Promise.all([fetchMe(), getActiveOrgId()]);
  if (!activeOrgId || !me) redirect("/");

  const isCs = me.userType === "central_services";

  const [templates, datapoints, mappings] = await Promise.all([
    fetchTemplates(),
    getFrameworkDatapoints().catch(() => [] as FrameworkDatapoint[]),
    getMappings().catch(() => [] as TemplateDatapointMapping[]),
  ]);

  // Show all templates (draft + published) so CS users can prepare
  // mappings before publication; the user can filter by name if the
  // list grows.
  const sortedTemplates = templates
    .map((t) => ({ id: t.id, name: t.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-PT"));

  return (
    <>
      <PageHeader
        title="Mapeamentos de datapoints"
        description="Para cada modelo, escolha os datapoints regulamentares que ele satisfaz. As alterações afetam a matriz de cobertura de todas as organizações."
        icon={Settings}
        breadcrumbs={[
          { label: "Cobertura", href: "/coverage" },
          { label: "Mapeamentos" },
        ]}
      />
      <div className="space-y-6 px-8 py-6">
        {!isCs ? (
          <InlineNotification
            kind="warning"
            title="Acesso limitado"
            subtitle="Apenas utilizadores dos serviços centrais podem editar mapeamentos. Pode consultar os existentes; qualquer alteração será rejeitada."
            lowContrast
            hideCloseButton
          />
        ) : null}

        <MappingsEditor
          templates={sortedTemplates}
          datapoints={datapoints}
          mappings={mappings}
        />
      </div>
    </>
  );
}
