import type { CsHealthBreakdown, CsHealthDimension, CsHealthTier } from "@bgreen/types";

// Inputs consumed by computeHealth. Mirrors the cs_org_health view's
// per-row payload — every nullable field signals "skip this dimension,
// redistribute weight."
export interface CsHealthSignals {
  daysSinceCreated: number;
  daysToFirstRecord: number | null;
  activatedIn30d: boolean;
  recordsCurrentQuarter: number;
  recordsPreviousQuarter: number;
  coveragePercent: number | null;
  daysSinceLastLogin: number | null;
  latestScoreYoyDelta: number | null;
  stagnantWorkflowsCount: number;
  oldestStagnantWorkflowDays: number | null;
}

export interface CsHealthResult {
  score: number;
  tier: CsHealthTier;
  breakdown: CsHealthBreakdown[];
  stagnation: {
    count: number;
    oldestDays: number | null;
  };
}

// The single source of truth for tuning. Re-tune = edit + redeploy; no
// schema migration required. Keep the shape stable so HEALTH_FORMULA
// can be exported and snapshot-tested over time.
export const HEALTH_FORMULA = {
  weights: {
    coverage: 0.4,
    engagement: 0.2,
    login: 0.2,
    activation: 0.1,
    score: 0.1,
  },
  tiers: { green: 75, yellow: 50 },
  engagement: { up: 100, flat: 60, down: 20 },
  login: {
    warm: { days: 7, score: 100 },
    recent: { days: 30, score: 70 },
    cool: { days: 90, score: 30 },
    cold: { score: 0 },
  },
  activation: { in30d: 100, eventual: 50, never: 0 },
  score: { positive: 100, flat: 70, negative: 30, missing: 70 },
} as const;

// Compute the composite CS health score for an organisation.
//
// Skipping rule: when a dimension's signal is null (typically coverage
// for orgs without required templates, or score-YoY for orgs without a
// year of scored history), its weight is redistributed pro-rata across
// the remaining dimensions. The org is judged on what we know about it,
// not penalised for missing data.
export function computeHealth(signals: CsHealthSignals): CsHealthResult {
  const dims: Array<{
    dim: CsHealthDimension;
    weight: number;
    rawScore: number | null;
  }> = [
    { dim: "coverage", weight: HEALTH_FORMULA.weights.coverage, rawScore: coverageScore(signals) },
    {
      dim: "engagement",
      weight: HEALTH_FORMULA.weights.engagement,
      rawScore: engagementScore(signals),
    },
    { dim: "login", weight: HEALTH_FORMULA.weights.login, rawScore: loginScore(signals) },
    {
      dim: "activation",
      weight: HEALTH_FORMULA.weights.activation,
      rawScore: activationScore(signals),
    },
    { dim: "score", weight: HEALTH_FORMULA.weights.score, rawScore: scoreDimensionScore(signals) },
  ];

  const live = dims.filter((d) => d.rawScore !== null);
  const skippedWeight = dims.reduce(
    (acc, d) => acc + (d.rawScore === null ? d.weight : 0),
    0,
  );
  const liveWeight = live.reduce((acc, d) => acc + d.weight, 0);

  // Redistribute pro-rata. If every dimension is null we collapse to a
  // neutral 50 — should never happen in practice (engagement and login
  // are always non-null) but handle it defensively.
  const breakdown: CsHealthBreakdown[] = live.map((d) => {
    const adjustedWeight =
      liveWeight === 0 ? 0 : d.weight + (skippedWeight * d.weight) / liveWeight;
    const raw = d.rawScore ?? 0;
    return {
      dimension: d.dim,
      rawScore: raw,
      weight: adjustedWeight,
      contribution: raw * adjustedWeight,
    };
  });

  const totalContribution = breakdown.reduce((acc, b) => acc + b.contribution, 0);
  const score = live.length === 0 ? 50 : Math.round(totalContribution);
  const tier: CsHealthTier =
    score >= HEALTH_FORMULA.tiers.green
      ? "green"
      : score >= HEALTH_FORMULA.tiers.yellow
        ? "yellow"
        : "red";

  return {
    score,
    tier,
    breakdown,
    stagnation: {
      count: signals.stagnantWorkflowsCount,
      oldestDays: signals.oldestStagnantWorkflowDays,
    },
  };
}

function coverageScore(s: CsHealthSignals): number | null {
  if (s.coveragePercent === null) return null;
  return Math.min(100, Math.max(0, s.coveragePercent));
}

function engagementScore(s: CsHealthSignals): number {
  // Trend is up/flat/down based on quarter-over-quarter record count.
  // Threshold: 20% swing either way breaks "flat".
  if (s.recordsPreviousQuarter === 0 && s.recordsCurrentQuarter === 0) {
    return HEALTH_FORMULA.engagement.flat;
  }
  if (s.recordsPreviousQuarter === 0) {
    return s.recordsCurrentQuarter > 0
      ? HEALTH_FORMULA.engagement.up
      : HEALTH_FORMULA.engagement.flat;
  }
  const ratio = s.recordsCurrentQuarter / s.recordsPreviousQuarter;
  if (ratio >= 1.2) return HEALTH_FORMULA.engagement.up;
  if (ratio <= 0.8) return HEALTH_FORMULA.engagement.down;
  return HEALTH_FORMULA.engagement.flat;
}

function loginScore(s: CsHealthSignals): number {
  // Never-logged-in orgs are scored as cold by convention. They might
  // be API-only (a service account uploading IES batches) — V12.1 emits
  // login events only on the AuthKit handshake, so that case looks
  // inactive here. v1.5 plans to also count programmatic-API events.
  if (s.daysSinceLastLogin === null) return HEALTH_FORMULA.login.cold.score;
  const { warm, recent, cool, cold } = HEALTH_FORMULA.login;
  if (s.daysSinceLastLogin <= warm.days) return warm.score;
  if (s.daysSinceLastLogin <= recent.days) return recent.score;
  if (s.daysSinceLastLogin <= cool.days) return cool.score;
  return cold.score;
}

function activationScore(s: CsHealthSignals): number {
  if (s.activatedIn30d) return HEALTH_FORMULA.activation.in30d;
  if (s.daysToFirstRecord !== null) return HEALTH_FORMULA.activation.eventual;
  return HEALTH_FORMULA.activation.never;
}

function scoreDimensionScore(s: CsHealthSignals): number | null {
  if (s.latestScoreYoyDelta === null) return HEALTH_FORMULA.score.missing;
  if (s.latestScoreYoyDelta > 0.01) return HEALTH_FORMULA.score.positive;
  if (s.latestScoreYoyDelta < -0.01) return HEALTH_FORMULA.score.negative;
  return HEALTH_FORMULA.score.flat;
}
