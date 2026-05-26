"use client";

import type { CsHealthTier } from "@bgreen/types";
import { Tag } from "@carbon/react";
import { useMemo, useState } from "react";
import type { CsHealthListEntry } from "@/lib/cs-health-types";
import { CohortChart } from "./CohortChart";
import { HealthDrawer } from "./HealthDrawer";
import { HealthFilters, type HealthFilterState } from "./HealthFilters";
import { HealthTable } from "./HealthTable";

interface HealthDashboardProps {
  entries: CsHealthListEntry[];
}

const TIER_LABEL: Record<CsHealthTier, string> = {
  green: "Verde",
  yellow: "Amarelo",
  red: "Vermelho",
};

const TIER_TAG: Record<CsHealthTier, "green" | "warm-gray" | "red"> = {
  green: "green",
  yellow: "warm-gray",
  red: "red",
};

export function HealthDashboard({ entries }: HealthDashboardProps) {
  const [filters, setFilters] = useState<HealthFilterState>({
    tier: null,
    hasStagnantWork: false,
  });
  const [openOrgId, setOpenOrgId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.tier && e.healthTier !== filters.tier) return false;
      if (filters.hasStagnantWork && e.row.stagnantWorkflowsCount === 0) return false;
      return true;
    });
  }, [entries, filters]);

  const totals = useMemo(() => {
    const total = entries.length;
    const byTier = { green: 0, yellow: 0, red: 0 };
    let loginCold = 0;
    let stagnantOrgs = 0;
    for (const e of entries) {
      byTier[e.healthTier] += 1;
      if ((e.row.daysSinceLastLogin ?? Number.POSITIVE_INFINITY) > 30) loginCold += 1;
      if (e.row.stagnantWorkflowsCount > 0) stagnantOrgs += 1;
    }
    return { total, byTier, loginCold, stagnantOrgs };
  }, [entries]);

  return (
    <div className="space-y-6">
      <TopStrip totals={totals} />
      <HealthFilters value={filters} onChange={setFilters} />
      <HealthTable
        entries={filtered}
        tierLabel={TIER_LABEL}
        tierTag={TIER_TAG}
        onRowClick={(orgId) => setOpenOrgId(orgId)}
      />
      <CohortChart />
      {openOrgId && (
        <HealthDrawer
          organizationId={openOrgId}
          tierLabel={TIER_LABEL}
          tierTag={TIER_TAG}
          onClose={() => setOpenOrgId(null)}
        />
      )}
    </div>
  );
}

interface Totals {
  total: number;
  byTier: Record<CsHealthTier, number>;
  loginCold: number;
  stagnantOrgs: number;
}

function TopStrip({ totals }: { totals: Totals }) {
  const pct = (n: number) =>
    totals.total === 0 ? 0 : Math.round((n / totals.total) * 100);
  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
      <Stat label="Total" value={String(totals.total)} />
      <Stat
        label="Verde"
        value={`${totals.byTier.green} (${pct(totals.byTier.green)}%)`}
        accent={<Tag size="sm" type="green">{TIER_LABEL.green}</Tag>}
      />
      <Stat
        label="Amarelo"
        value={`${totals.byTier.yellow} (${pct(totals.byTier.yellow)}%)`}
        accent={<Tag size="sm" type="warm-gray">{TIER_LABEL.yellow}</Tag>}
      />
      <Stat
        label="Vermelho"
        value={`${totals.byTier.red} (${pct(totals.byTier.red)}%)`}
        accent={<Tag size="sm" type="red">{TIER_LABEL.red}</Tag>}
      />
      <Stat
        label="Sem login há >30d / com trabalho parado"
        value={`${totals.loginCold} / ${totals.stagnantOrgs}`}
      />
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: React.ReactNode;
}) {
  return (
    <div className="rounded-sm border border-[--cds-border-subtle] bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-[--cds-text-secondary]">
          {label}
        </span>
        {accent}
      </div>
      <div className="mt-2 font-mono text-2xl text-[--cds-text-primary]">{value}</div>
    </div>
  );
}
