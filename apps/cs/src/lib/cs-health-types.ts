// Pure type module — no runtime imports. Client components can import
// these freely without pulling in `api-client.ts` (which depends on
// `next/headers` for the cs_session cookie and is therefore server-only).

import type { CsHealthRow, CsHealthTier } from "@bgreen/types";

export interface CsHealthListEntry {
  row: CsHealthRow;
  healthScore: number;
  healthTier: CsHealthTier;
}

export interface CsHealthDetail {
  row: CsHealthRow;
  healthScore: number;
  healthTier: CsHealthTier;
  snapshots: Array<{ snapshotDate: string; metrics: CsHealthRow }>;
}

export interface CsCohortActivationResult {
  cohortMonth: string;
  totalOrgs: number;
  activatedIn30d: number;
  percentActivated: number;
}

export interface CsHealthListFilter {
  tier?: CsHealthTier;
  hasStagnantWork?: boolean;
  sortBy?:
    | "tier"
    | "daysSinceLastLogin"
    | "stagnantWorkflowsCount"
    | "oldestStagnantWorkflowDays";
}
