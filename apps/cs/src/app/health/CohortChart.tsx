"use client";

import { useEffect, useState } from "react";
import type { CsCohortActivationResult } from "@/lib/cs-health-types";
import { getCohortActivation } from "./actions";

function monthOffset(d: Date, offset: number): string {
  const x = new Date(d.getUTCFullYear(), d.getUTCMonth() + offset, 1);
  return `${x.getUTCFullYear()}-${String(x.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function CohortChart() {
  const [results, setResults] = useState<CsCohortActivationResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => monthOffset(now, -5 + i));
    Promise.all(months.map((m) => getCohortActivation(m))).then((arr) => {
      if (cancelled) return;
      const ok = arr.filter((x): x is CsCohortActivationResult => x !== null);
      setResults(ok);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const maxOrgs = Math.max(1, ...results.map((r) => r.totalOrgs));

  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[--cds-text-secondary]">
        Ativação por coorte (últimos 6 meses)
      </h3>
      {loading ? (
        <p className="text-sm text-[--cds-text-secondary]">A carregar…</p>
      ) : results.length === 0 ? (
        <p className="text-sm text-[--cds-text-secondary]">Sem dados de coortes.</p>
      ) : (
        <div className="space-y-2">
          {results.map((r) => {
            const fill = r.totalOrgs > 0 ? (r.activatedIn30d / r.totalOrgs) * 100 : 0;
            const widthPct = (r.totalOrgs / maxOrgs) * 100;
            return (
              <div key={r.cohortMonth} className="grid grid-cols-[5rem_1fr_6rem] items-center gap-3">
                <span className="font-mono text-xs">{r.cohortMonth}</span>
                <div
                  className="relative h-6 rounded-sm bg-[--cds-layer]"
                  style={{ width: `${widthPct}%`, minWidth: "2rem" }}
                  title={`${r.activatedIn30d}/${r.totalOrgs} ativadas em 30d`}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-[--cds-interactive]"
                    style={{ width: `${fill}%` }}
                  />
                </div>
                <span className="text-right font-mono text-xs">
                  {r.percentActivated}%
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
