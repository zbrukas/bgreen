// V10.4 — framework coverage entry. Server component: reads the
// framework + applicability toggle from search params, fetches the
// deterministic matrix, hands it off to the client view.

import { PageHeader } from "@bgreen/ui";
import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { getCoverageMatrix } from "@/lib/coverage-actions";
import type { CoverageMatrix, Framework } from "@/lib/coverage-types";
import { ListChecked } from "@carbon/icons-react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { CoverageHeaderAction } from "./_components/CoverageHeaderAction";
import { CoverageMatrixView } from "./_components/CoverageMatrixView";
import { FrameworkPicker } from "./_components/FrameworkPicker";

export const dynamic = "force-dynamic";

function resolveFramework(raw: string | undefined): Framework {
  if (raw === "ghg" || raw === "gri" || raw === "esrs") return raw;
  return "esrs";
}

export default async function CoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ framework?: string; includeNonApplicable?: string }>;
}) {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, activeOrgId, params] = await Promise.all([
    fetchMe(),
    getActiveOrgId(),
    searchParams,
  ]);
  if (!activeOrgId || !me) redirect("/");

  const framework = resolveFramework(params.framework);
  const includeNonApplicable = params.includeNonApplicable === "true";

  // Best-effort fetch — empty matrix is rendered as the empty state
  // and the CTA still works.
  let matrix: CoverageMatrix;
  try {
    matrix = await getCoverageMatrix(framework, { includeNonApplicable });
  } catch {
    matrix = {
      framework,
      rows: [],
      counts: { covered: 0, partial: 0, missing: 0, total: 0 },
    };
  }

  const isCs = me.userType === "central_services";

  return (
    <>
      <PageHeader
        title="Cobertura regulamentar"
        description="Datapoints do framework escolhido com o estado actual: coberto, parcial ou em falta."
        icon={ListChecked}
        actions={isCs ? <CoverageHeaderAction /> : undefined}
      />
      <div className="space-y-8 px-8 py-8">
        <FrameworkPicker
          active={framework}
          extraSearch={includeNonApplicable ? "includeNonApplicable=true" : undefined}
        />
        <CoverageMatrixView
          framework={framework}
          initialMatrix={matrix}
          initialIncludeNonApplicable={includeNonApplicable}
        />
      </div>
    </>
  );
}
