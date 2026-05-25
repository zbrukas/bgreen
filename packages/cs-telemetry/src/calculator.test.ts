import { describe, expect, it } from "vitest";
import { type CsHealthSignals, computeHealth, HEALTH_FORMULA } from "./calculator.js";

function signals(overrides: Partial<CsHealthSignals> = {}): CsHealthSignals {
  return {
    daysSinceCreated: 90,
    daysToFirstRecord: 12,
    activatedIn30d: true,
    recordsCurrentQuarter: 3,
    recordsPreviousQuarter: 2,
    coveragePercent: 80,
    daysSinceLastLogin: 3,
    latestScoreYoyDelta: 0.05,
    stagnantWorkflowsCount: 0,
    oldestStagnantWorkflowDays: null,
    ...overrides,
  };
}

describe("computeHealth", () => {
  it("fresh org with no signals lands in red", () => {
    const result = computeHealth(
      signals({
        daysSinceCreated: 2,
        daysToFirstRecord: null,
        activatedIn30d: false,
        recordsCurrentQuarter: 0,
        recordsPreviousQuarter: 0,
        coveragePercent: null,
        daysSinceLastLogin: null,
        latestScoreYoyDelta: null,
      }),
    );
    // login=0 (never), activation=0 (never), engagement=60 (flat),
    // coverage null → redistributed, score null → 70 (missing).
    // No skipped + 60 + 70 across redistributed weights → yellow-ish low.
    expect(result.tier).toBe("red");
    expect(result.score).toBeLessThan(HEALTH_FORMULA.tiers.yellow);
  });

  it("fully engaged org is green", () => {
    const result = computeHealth(signals());
    expect(result.tier).toBe("green");
    expect(result.score).toBeGreaterThanOrEqual(HEALTH_FORMULA.tiers.green);
  });

  it("activated then stalled lands in yellow when other signals weaken", () => {
    // coverage 60×0.4=24, engagement down 20×0.2=4, login recent 70×0.2=14,
    // activation in30d 100×0.1=10, score negative 30×0.1=3 → 55 → yellow.
    const result = computeHealth(
      signals({
        activatedIn30d: true,
        recordsCurrentQuarter: 1,
        recordsPreviousQuarter: 3, // down trend (ratio 0.33)
        coveragePercent: 60,
        daysSinceLastLogin: 20, // recent
        latestScoreYoyDelta: -0.05, // negative
      }),
    );
    expect(result.tier).toBe("yellow");
  });

  it("score-trending-down without other red flags stays yellow", () => {
    const result = computeHealth(
      signals({
        coveragePercent: 70,
        recordsCurrentQuarter: 2,
        recordsPreviousQuarter: 2, // flat
        daysSinceLastLogin: 15, // recent
        latestScoreYoyDelta: -0.1, // negative
      }),
    );
    expect(result.tier).toBe("yellow");
    const scoreDim = result.breakdown.find((b) => b.dimension === "score");
    expect(scoreDim?.rawScore).toBe(HEALTH_FORMULA.score.negative);
  });

  it("no required templates skips coverage and redistributes weight", () => {
    const result = computeHealth(signals({ coveragePercent: null }));
    expect(result.breakdown.find((b) => b.dimension === "coverage")).toBeUndefined();
    const totalWeight = result.breakdown.reduce((a, b) => a + b.weight, 0);
    expect(totalWeight).toBeCloseTo(1, 5);
  });

  it("missing latest score still includes the score dimension at 70 (missing)", () => {
    const result = computeHealth(signals({ latestScoreYoyDelta: null }));
    const scoreDim = result.breakdown.find((b) => b.dimension === "score");
    // null delta is treated as "missing → 70", not as a skip.
    expect(scoreDim?.rawScore).toBe(HEALTH_FORMULA.score.missing);
  });

  it("never-logged-in-but-records-via-API still gets a login dimension", () => {
    const result = computeHealth(
      signals({ daysSinceLastLogin: null, recordsCurrentQuarter: 5 }),
    );
    const loginDim = result.breakdown.find((b) => b.dimension === "login");
    expect(loginDim?.rawScore).toBe(HEALTH_FORMULA.login.cold.score);
  });

  it("stagnant but otherwise green stays green — stagnation does NOT touch score", () => {
    const result = computeHealth(
      signals({ stagnantWorkflowsCount: 5, oldestStagnantWorkflowDays: 30 }),
    );
    expect(result.tier).toBe("green");
    expect(result.stagnation.count).toBe(5);
    expect(result.stagnation.oldestDays).toBe(30);
  });

  it("stagnant AND red — both signals coexist correctly", () => {
    const result = computeHealth(
      signals({
        activatedIn30d: false,
        daysToFirstRecord: null,
        recordsCurrentQuarter: 0,
        recordsPreviousQuarter: 5, // down
        coveragePercent: 10,
        daysSinceLastLogin: 120, // cold
        latestScoreYoyDelta: -0.2,
        stagnantWorkflowsCount: 3,
        oldestStagnantWorkflowDays: 45,
      }),
    );
    expect(result.tier).toBe("red");
    expect(result.stagnation.count).toBe(3);
  });

  it("engagement trend ratio: previous=0 + current>0 ⇒ up", () => {
    const result = computeHealth(
      signals({ recordsCurrentQuarter: 3, recordsPreviousQuarter: 0 }),
    );
    expect(
      result.breakdown.find((b) => b.dimension === "engagement")?.rawScore,
    ).toBe(HEALTH_FORMULA.engagement.up);
  });

  it("engagement trend ratio: both 0 ⇒ flat", () => {
    const result = computeHealth(
      signals({ recordsCurrentQuarter: 0, recordsPreviousQuarter: 0 }),
    );
    expect(
      result.breakdown.find((b) => b.dimension === "engagement")?.rawScore,
    ).toBe(HEALTH_FORMULA.engagement.flat);
  });

  it("login bucket boundaries (≤7d warm, ≤30d recent, ≤90d cool, >90d cold)", () => {
    expect(computeBucket(7)).toBe(HEALTH_FORMULA.login.warm.score);
    expect(computeBucket(8)).toBe(HEALTH_FORMULA.login.recent.score);
    expect(computeBucket(30)).toBe(HEALTH_FORMULA.login.recent.score);
    expect(computeBucket(31)).toBe(HEALTH_FORMULA.login.cool.score);
    expect(computeBucket(90)).toBe(HEALTH_FORMULA.login.cool.score);
    expect(computeBucket(91)).toBe(HEALTH_FORMULA.login.cold.score);
  });

  it("activation tiers", () => {
    expect(
      computeHealth(signals({ activatedIn30d: true })).breakdown.find(
        (b) => b.dimension === "activation",
      )?.rawScore,
    ).toBe(HEALTH_FORMULA.activation.in30d);
    expect(
      computeHealth(
        signals({ activatedIn30d: false, daysToFirstRecord: 60 }),
      ).breakdown.find((b) => b.dimension === "activation")?.rawScore,
    ).toBe(HEALTH_FORMULA.activation.eventual);
    expect(
      computeHealth(
        signals({ activatedIn30d: false, daysToFirstRecord: null }),
      ).breakdown.find((b) => b.dimension === "activation")?.rawScore,
    ).toBe(HEALTH_FORMULA.activation.never);
  });

  it("breakdown weights always sum to 1 across non-skipped dimensions", () => {
    const r1 = computeHealth(signals());
    expect(r1.breakdown.reduce((a, b) => a + b.weight, 0)).toBeCloseTo(1, 5);
    const r2 = computeHealth(signals({ coveragePercent: null }));
    expect(r2.breakdown.reduce((a, b) => a + b.weight, 0)).toBeCloseTo(1, 5);
  });

  it("score caps at 100 and floors at 0", () => {
    const r1 = computeHealth(signals({ coveragePercent: 250 }));
    expect(r1.score).toBeLessThanOrEqual(100);
    const r2 = computeHealth(
      signals({
        activatedIn30d: false,
        daysToFirstRecord: null,
        recordsCurrentQuarter: 0,
        recordsPreviousQuarter: 10,
        coveragePercent: -10,
        daysSinceLastLogin: 1000,
        latestScoreYoyDelta: -1,
      }),
    );
    expect(r2.score).toBeGreaterThanOrEqual(0);
  });
});

function computeBucket(days: number): number {
  return (
    computeHealth(signals({ daysSinceLastLogin: days })).breakdown.find(
      (b) => b.dimension === "login",
    )?.rawScore ?? -1
  );
}
