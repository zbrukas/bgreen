// V10.4 — CS-only mapping admin page. The route stays accessible to
// any authed user (the page renders a forbidden notice for non-CS),
// matching the "auth at the page boundary; FGA at the action" pattern
// used elsewhere in the app.

import { Alert } from "@/components/ui/alert";
import { Header } from "@/app/_components/Header/Header";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe, fetchMyOrganizations, fetchTemplates } from "@/lib/api-client";
import { getFrameworkDatapoints, getMappings } from "@/lib/coverage-actions";
import type {
  FrameworkDatapoint,
  TemplateDatapointMapping,
} from "@/lib/coverage-types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MappingsEditor } from "./_components/MappingsEditor";

export const dynamic = "force-dynamic";

export default async function MappingsPage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, orgs, activeOrgId] = await Promise.all([
    fetchMe(),
    fetchMyOrganizations(),
    getActiveOrgId(),
  ]);
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
      <Header
        userEmail={auth.user.email}
        organizations={orgs}
        activeOrganizationId={activeOrgId}
        activeOrganizationRole={me.activeOrganizationRole}
      />
      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <p>
          <Link
            href="/coverage"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Voltar à cobertura
          </Link>
        </p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Mapeamentos de datapoints
          </h1>
          <p className="text-sm text-muted-foreground">
            Para cada modelo, escolha os datapoints regulamentares que ele
            satisfaz. As alterações afetam a matriz de cobertura de todas as
            organizações.
          </p>
        </div>

        {!isCs ? (
          <Alert variant="warning">
            Apenas utilizadores dos serviços centrais podem editar mapeamentos.
            Pode consultar os mapeamentos existentes; qualquer alteração será
            rejeitada.
          </Alert>
        ) : null}

        <MappingsEditor
          templates={sortedTemplates}
          datapoints={datapoints}
          mappings={mappings}
        />
      </main>
    </>
  );
}
