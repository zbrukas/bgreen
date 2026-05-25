import { describe, expect, it } from "vitest";
import {
  ALL_FRAMEWORK_DATAPOINTS,
  ESRS_E1_DATAPOINTS,
  GHG_PROTOCOL_DATAPOINTS,
  GRI_DATAPOINTS,
  evaluateSectorApplicability,
} from "./index.js";

describe("framework datapoint catalogs", () => {
  it("ESRS E1 ships ~30 datapoints", () => {
    expect(ESRS_E1_DATAPOINTS.length).toBeGreaterThanOrEqual(25);
    expect(ESRS_E1_DATAPOINTS.length).toBeLessThanOrEqual(35);
  });

  it("GHG Protocol ships ~15 datapoints", () => {
    expect(GHG_PROTOCOL_DATAPOINTS.length).toBeGreaterThanOrEqual(13);
    expect(GHG_PROTOCOL_DATAPOINTS.length).toBeLessThanOrEqual(18);
  });

  it("GRI ships ~20 datapoints", () => {
    expect(GRI_DATAPOINTS.length).toBeGreaterThanOrEqual(18);
    expect(GRI_DATAPOINTS.length).toBeLessThanOrEqual(25);
  });

  it("all datapoint ids are unique across frameworks", () => {
    const ids = ALL_FRAMEWORK_DATAPOINTS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every datapoint id starts with its framework prefix", () => {
    for (const dp of ALL_FRAMEWORK_DATAPOINTS) {
      expect(dp.id.startsWith(`${dp.framework}-`)).toBe(true);
    }
  });

  it("titles + descriptions are non-empty pt-PT strings", () => {
    for (const dp of ALL_FRAMEWORK_DATAPOINTS) {
      expect(dp.title.length).toBeGreaterThan(5);
      expect(dp.title.length).toBeLessThanOrEqual(120);
      expect(dp.description.length).toBeGreaterThan(20);
    }
  });

  it("ESRS E1 marks energy-intensive datapoints with a CAE-3 list", () => {
    const energyIntensive = ESRS_E1_DATAPOINTS.filter(
      (d) => d.sectorApplicability.kind === "cae3-list",
    );
    // At least the intensity + production datapoints are energy-intensive.
    expect(energyIntensive.length).toBeGreaterThanOrEqual(2);
    for (const dp of energyIntensive) {
      if (dp.sectorApplicability.kind !== "cae3-list") continue;
      // ETS-scoped list is finite and small; sanity-check the upper bound.
      expect(dp.sectorApplicability.values.length).toBeGreaterThan(5);
      expect(dp.sectorApplicability.values.length).toBeLessThan(50);
    }
  });
});

describe("evaluateSectorApplicability", () => {
  it("'all' rule returns true regardless of CAE-3", () => {
    expect(evaluateSectorApplicability({ kind: "all" }, "351")).toBe(true);
    expect(evaluateSectorApplicability({ kind: "all" }, null)).toBe(true);
    expect(evaluateSectorApplicability({ kind: "all" }, "99999")).toBe(true);
  });

  it("'cae3-list' returns true for matching CAE-3, false otherwise", () => {
    const rule = { kind: "cae3-list" as const, values: ["351", "352"] };
    expect(evaluateSectorApplicability(rule, "351")).toBe(true);
    expect(evaluateSectorApplicability(rule, "352")).toBe(true);
    expect(evaluateSectorApplicability(rule, "471")).toBe(false);
  });

  it("'cae3-list' returns true for null CAE-3 (permissive)", () => {
    // INCOMPLETE-mode orgs without a CAE see every row + the UI flags
    // applicability as unknown — better than silently hiding.
    const rule = { kind: "cae3-list" as const, values: ["351"] };
    expect(evaluateSectorApplicability(rule, null)).toBe(true);
  });
});
