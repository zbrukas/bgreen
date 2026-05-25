import { db, schema } from "@bgreen/db";
import { computeHealth, type CsHealthSignals } from "@bgreen/cs-telemetry";
import type { CsHealthRow, CsHealthTier } from "@bgreen/types";
import { and, eq, gte, lte, sql } from "drizzle-orm";

// V12.2 — CS health read surface. Reads `cs_org_health` for the live
// row, `cs_health_snapshots` for trend, computes score + tier on-the-fly
// via @bgreen/cs-telemetry. Snapshot job upserts daily.

export interface CsHealthListFilter {
  tier?: CsHealthTier;
  hasStagnantWork?: boolean;
  sortBy?:
    | "tier"
    | "daysSinceLastLogin"
    | "stagnantWorkflowsCount"
    | "oldestStagnantWorkflowDays";
}

export interface CsHealthListEntry {
  row: CsHealthRow;
  healthScore: number;
  healthTier: CsHealthTier;
}

export interface CsHealthDetail {
  row: CsHealthRow;
  healthScore: number;
  healthTier: CsHealthTier;
  // Last 90 snapshots, oldest first — drives the trend sparkline in V12.3.
  snapshots: Array<{ snapshotDate: string; metrics: CsHealthRow }>;
}

export interface CsCohortActivationResult {
  cohortMonth: string; // YYYY-MM
  totalOrgs: number;
  activatedIn30d: number;
  percentActivated: number;
}

interface RawViewRow extends Record<string, unknown> {
  organization_id: string;
  created_at: Date;
  days_since_created: number;
  first_record_submitted_at: Date | null;
  days_to_first_record: number | null;
  activated_in_30d: boolean;
  records_current_quarter: number;
  records_previous_quarter: number;
  engagement_trend: "up" | "flat" | "down";
  required_templates_count: number;
  required_templates_with_current_period_data: number;
  coverage_percent: string | null;
  latest_score_yoy_delta: string | null;
  last_login_at: Date | null;
  days_since_last_login: number | null;
  wau_count: number;
  mau_count: number;
  stagnant_workflows_count: number;
  oldest_stagnant_workflow_days: number | null;
  stagnant_workflows_by_definition: Record<string, number>;
  computed_at: Date;
}

function parseNumeric(v: string | null): number | null {
  if (v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rowFromView(raw: RawViewRow): CsHealthRow {
  const signals: CsHealthSignals = {
    daysSinceCreated: raw.days_since_created,
    daysToFirstRecord: raw.days_to_first_record,
    activatedIn30d: raw.activated_in_30d,
    recordsCurrentQuarter: raw.records_current_quarter,
    recordsPreviousQuarter: raw.records_previous_quarter,
    coveragePercent: parseNumeric(raw.coverage_percent),
    daysSinceLastLogin: raw.days_since_last_login,
    latestScoreYoyDelta: parseNumeric(raw.latest_score_yoy_delta),
    stagnantWorkflowsCount: raw.stagnant_workflows_count,
    oldestStagnantWorkflowDays: raw.oldest_stagnant_workflow_days,
  };
  const health = computeHealth(signals);
  return {
    organizationId: raw.organization_id,
    createdAt: raw.created_at.toISOString(),
    daysSinceCreated: raw.days_since_created,
    firstRecordSubmittedAt: raw.first_record_submitted_at?.toISOString() ?? null,
    daysToFirstRecord: raw.days_to_first_record,
    activatedIn30d: raw.activated_in_30d,
    recordsCurrentQuarter: raw.records_current_quarter,
    recordsPreviousQuarter: raw.records_previous_quarter,
    engagementTrend: raw.engagement_trend,
    requiredTemplatesCount: raw.required_templates_count,
    requiredTemplatesWithCurrentPeriodData: raw.required_templates_with_current_period_data,
    coveragePercent: signals.coveragePercent,
    latestScoreYoyDelta: signals.latestScoreYoyDelta,
    lastLoginAt: raw.last_login_at?.toISOString() ?? null,
    daysSinceLastLogin: raw.days_since_last_login,
    wauCount: raw.wau_count,
    mauCount: raw.mau_count,
    stagnantWorkflowsCount: raw.stagnant_workflows_count,
    oldestStagnantWorkflowDays: raw.oldest_stagnant_workflow_days,
    stagnantWorkflowsByDefinition: raw.stagnant_workflows_by_definition ?? {},
    healthScore: health.score,
    healthTier: health.tier,
    computedAt: raw.computed_at.toISOString(),
  };
}

export class CsHealthService {
  async list(filter: CsHealthListFilter): Promise<CsHealthListEntry[]> {
    // Cross-tenant by design — caller is already gated to CS-admin.
    const rows = await db.execute<RawViewRow>(sql`SELECT * FROM cs_org_health`);
    const all: CsHealthListEntry[] = rows.rows.map((raw) => {
      const row = rowFromView(raw);
      return { row, healthScore: row.healthScore, healthTier: row.healthTier };
    });

    let filtered = all;
    if (filter.tier) {
      filtered = filtered.filter((e) => e.healthTier === filter.tier);
    }
    if (filter.hasStagnantWork) {
      filtered = filtered.filter((e) => e.row.stagnantWorkflowsCount > 0);
    }

    filtered.sort(compareForList(filter.sortBy));
    return filtered;
  }

  async get(organizationId: string): Promise<CsHealthDetail | null> {
    const rows = await db.execute<RawViewRow>(
      sql`SELECT * FROM cs_org_health WHERE organization_id = ${organizationId}`,
    );
    const raw = rows.rows[0];
    if (!raw) return null;
    const row = rowFromView(raw);
    const snapshots = await db
      .select({
        snapshotDate: schema.csHealthSnapshots.snapshotDate,
        metrics: schema.csHealthSnapshots.metrics,
      })
      .from(schema.csHealthSnapshots)
      .where(
        and(
          eq(schema.csHealthSnapshots.organizationId, organizationId),
          gte(
            schema.csHealthSnapshots.snapshotDate,
            isoDateString(new Date(Date.now() - 90 * 24 * 3600_000)),
          ),
        ),
      )
      .orderBy(schema.csHealthSnapshots.snapshotDate);
    return {
      row,
      healthScore: row.healthScore,
      healthTier: row.healthTier,
      snapshots: snapshots.map((s) => ({
        snapshotDate: s.snapshotDate,
        metrics: s.metrics as CsHealthRow,
      })),
    };
  }

  async cohortActivation(cohortMonth: string): Promise<CsCohortActivationResult> {
    // cohortMonth is YYYY-MM. Range is [cohortMonth-01, cohortMonth+1-01).
    const start = `${cohortMonth}-01`;
    const startDate = new Date(`${start}T00:00:00.000Z`);
    if (Number.isNaN(startDate.getTime())) {
      throw new Error(`invalid cohort month: ${cohortMonth}`);
    }
    const endDate = new Date(startDate);
    endDate.setUTCMonth(endDate.getUTCMonth() + 1);

    const totals = await db
      .select({
        total: sql<number>`COUNT(*)::int`,
      })
      .from(schema.organizations)
      .where(
        and(
          gte(schema.organizations.createdAt, startDate),
          lte(schema.organizations.createdAt, endDate),
        ),
      );
    const totalOrgs = totals[0]?.total ?? 0;
    if (totalOrgs === 0) {
      return { cohortMonth, totalOrgs: 0, activatedIn30d: 0, percentActivated: 0 };
    }

    // Activation count via the view (which already encodes activatedIn30d).
    const counts = await db.execute<{ activated: number }>(sql`
      SELECT COUNT(*)::int AS activated
      FROM cs_org_health v
      JOIN organizations o ON o.id = v.organization_id
      WHERE o.created_at >= ${startDate}
        AND o.created_at < ${endDate}
        AND v.activated_in_30d = true
    `);
    const activated = counts.rows[0]?.activated ?? 0;
    return {
      cohortMonth,
      totalOrgs,
      activatedIn30d: activated,
      percentActivated: Math.round((activated / totalOrgs) * 10000) / 100,
    };
  }

  // Inngest cron entry. Idempotent on the (org, day) PK via ON CONFLICT.
  async takeDailySnapshot(): Promise<{ inserted: number; pruned: number }> {
    const insertResult = await db.execute(sql`
      INSERT INTO cs_health_snapshots (organization_id, snapshot_date, metrics)
      SELECT
        v.organization_id,
        CURRENT_DATE,
        to_jsonb(v.*)
      FROM cs_org_health v
      ON CONFLICT (organization_id, snapshot_date)
      DO UPDATE SET metrics = EXCLUDED.metrics, computed_at = now()
    `);
    const pruneResult = await db.execute(sql`
      DELETE FROM cs_health_snapshots
      WHERE snapshot_date < CURRENT_DATE - INTERVAL '18 months'
    `);
    return {
      inserted: insertResult.rowCount ?? 0,
      pruned: pruneResult.rowCount ?? 0,
    };
  }
}

function compareForList(
  sortBy: CsHealthListFilter["sortBy"],
): (a: CsHealthListEntry, b: CsHealthListEntry) => number {
  // Default: red first, then by days-since-last-login descending so the
  // most-neglected reds rise to the top.
  const tierWeight = (t: CsHealthTier) => (t === "red" ? 0 : t === "yellow" ? 1 : 2);
  if (!sortBy || sortBy === "tier") {
    return (a, b) =>
      tierWeight(a.healthTier) - tierWeight(b.healthTier) ||
      (b.row.daysSinceLastLogin ?? -1) - (a.row.daysSinceLastLogin ?? -1);
  }
  if (sortBy === "daysSinceLastLogin") {
    return (a, b) => (b.row.daysSinceLastLogin ?? -1) - (a.row.daysSinceLastLogin ?? -1);
  }
  if (sortBy === "stagnantWorkflowsCount") {
    return (a, b) => b.row.stagnantWorkflowsCount - a.row.stagnantWorkflowsCount;
  }
  return (a, b) =>
    (b.row.oldestStagnantWorkflowDays ?? -1) - (a.row.oldestStagnantWorkflowDays ?? -1);
}

function isoDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
