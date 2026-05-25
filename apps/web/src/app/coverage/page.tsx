// V10.4 — framework coverage entry. Server component: reads the
// framework + applicability toggle from search params, fetches the
// deterministic matrix, hands it off to the client view.

import { getActiveOrgId } from "@/lib/active-org";
import { fetchMe } from "@/lib/api-client";
import { getCoverageMatrix } from "@/lib/coverage-actions";
import type { CoverageMatrix, Framework } from "@/lib/coverage-types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
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
      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Cobertura regulamentar</h1>
            <p className="text-sm text-muted-foreground">
              Datapoints do framework escolhido com o estado actual: coberto,
              parcial ou em falta.
            </p>
          </div>
          {isCs ? (
            <Link
              href="/coverage/mappings"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Gerir mapeamentos →
            </Link>
          ) : null}
        </div>

        <FrameworkPicker
          active={framework}
          extraSearch={
            includeNonApplicable ? "includeNonApplicable=true" : undefined
          }
        />

        <CoverageMatrixView
          framework={framework}
          initialMatrix={matrix}
          initialIncludeNonApplicable={includeNonApplicable}
        />
      </main>
    </>
  );
}
