// V10.2 — CoverageCalculator unit tests.
//
// Covers the deep-module spec from the V10 plan: applicability rule
// (sector match), evidence rollup (multiple records → one datapoint),
// partial-coverage (template mapped, no records), missing-coverage (no
// template mapped), datapoint not applicable to sector (excluded
// unless includeNonApplicable=true), framework filtering.

import type { Framework, FrameworkDatapoint } from "@bgreen/frameworks";
import { describe, expect, it } from "vitest";
import type { TemplateDatapointMapping } from "../domain/types.js";
import {
  type CalculatorRecord,
  calculateCoverage,
} from "./coverage-calculator.js";

// ── fixtures ───────────────────────────────────────────────────────

function makeDp(
  id: string,
  framework: Framework = "esrs",
  sector: "all" | { cae3List: string[] } = "all",
): FrameworkDatapoint {
  return {
    id,
    framework,
    topic: framework === "esrs" ? "E1" : "Scope 1",
    code: id.toUpperCase(),
    title: `Datapoint ${id}`,
    description: `pt-PT description for ${id}.`,
    sectorApplicability:
      sector === "all" ? { kind: "all" } : { kind: "cae3-list", values: sector.cae3List },
    version: "esrs-2024",
  };
}

function makeMapping(
  templateId: string,
  frameworkDatapointId: string,
): TemplateDatapointMapping {
  return {
    id: `mapping-${templateId}-${frameworkDatapointId}`,
    templateId,
    frameworkDatapointId,
    createdByUserId: "user-1",
    createdAt: new Date().toISOString(),
  };
}

function makeRecord(
  id: string,
  templateId: string,
  status = "submitted",
): CalculatorRecord {
  return { id, templateId, status };
}

// ── status rules ───────────────────────────────────────────────────

describe("calculateCoverage — status derivation", () => {
  it("missing: no template mapped → status=missing, empty evidence", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-1")],
      mappings: [],
      records: [],
      cae3: "620",
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.status).toBe("missing");
    expect(result.rows[0]?.evidence.templateIds).toEqual([]);
    expect(result.rows[0]?.evidence.recordIds).toEqual([]);
    expect(result.counts.missing).toBe(1);
  });

  it("partial: template mapped but no submitted records → partial, only templateIds in evidence", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-1")],
      mappings: [makeMapping("tpl-1", "esrs-e1-1")],
      records: [],
      cae3: "620",
    });
    expect(result.rows[0]?.status).toBe("partial");
    expect(result.rows[0]?.evidence.templateIds).toEqual(["tpl-1"]);
    expect(result.rows[0]?.evidence.recordIds).toEqual([]);
    expect(result.counts.partial).toBe(1);
  });

  it("covered: mapped template with a submitted record → covered, evidence rolled up", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-1")],
      mappings: [makeMapping("tpl-1", "esrs-e1-1")],
      records: [makeRecord("rec-1", "tpl-1", "submitted")],
      cae3: "620",
    });
    expect(result.rows[0]?.status).toBe("covered");
    expect(result.rows[0]?.evidence.templateIds).toEqual(["tpl-1"]);
    expect(result.rows[0]?.evidence.recordIds).toEqual(["rec-1"]);
    expect(result.counts.covered).toBe(1);
  });

  it("drafts + changes_requested are ignored for evidence rollup", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-1")],
      mappings: [makeMapping("tpl-1", "esrs-e1-1")],
      records: [
        makeRecord("rec-1", "tpl-1", "draft"),
        makeRecord("rec-2", "tpl-1", "changes_requested"),
      ],
      cae3: "620",
    });
    // Mapped but no qualifying record → still partial.
    expect(result.rows[0]?.status).toBe("partial");
    expect(result.rows[0]?.evidence.recordIds).toEqual([]);
  });

  it("approved + certified both count as evidence", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-1")],
      mappings: [makeMapping("tpl-1", "esrs-e1-1")],
      records: [
        makeRecord("rec-a", "tpl-1", "approved"),
        makeRecord("rec-b", "tpl-1", "certified"),
      ],
      cae3: "620",
    });
    expect(result.rows[0]?.status).toBe("covered");
    expect(result.rows[0]?.evidence.recordIds.sort()).toEqual(["rec-a", "rec-b"]);
  });
});

// ── evidence rollup ────────────────────────────────────────────────

describe("calculateCoverage — evidence rollup across multiple templates", () => {
  it("multiple templates map to one datapoint; evidence aggregates from both", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-5-energy-total")],
      mappings: [
        makeMapping("tpl-energy-elec", "esrs-e1-5-energy-total"),
        makeMapping("tpl-energy-fuel", "esrs-e1-5-energy-total"),
      ],
      records: [
        makeRecord("rec-elec-1", "tpl-energy-elec"),
        makeRecord("rec-fuel-1", "tpl-energy-fuel"),
        makeRecord("rec-fuel-2", "tpl-energy-fuel"),
      ],
      cae3: "620",
    });
    expect(result.rows[0]?.status).toBe("covered");
    expect(result.rows[0]?.evidence.templateIds.sort()).toEqual([
      "tpl-energy-elec",
      "tpl-energy-fuel",
    ]);
    expect(result.rows[0]?.evidence.recordIds.sort()).toEqual([
      "rec-elec-1",
      "rec-fuel-1",
      "rec-fuel-2",
    ]);
  });

  it("one template satisfies multiple datapoints; both rows mark covered", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-6-scope1"), makeDp("esrs-e1-6-scope2")],
      mappings: [
        makeMapping("tpl-emissions", "esrs-e1-6-scope1"),
        makeMapping("tpl-emissions", "esrs-e1-6-scope2"),
      ],
      records: [makeRecord("rec-em-1", "tpl-emissions")],
      cae3: "351",
    });
    expect(result.rows).toHaveLength(2);
    for (const row of result.rows) {
      expect(row.status).toBe("covered");
      expect(row.evidence.recordIds).toEqual(["rec-em-1"]);
    }
  });
});

// ── applicability ──────────────────────────────────────────────────

describe("calculateCoverage — sector applicability", () => {
  it("non-applicable datapoint is excluded by default", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-intensity", "esrs", { cae3List: ["351", "352"] })],
      mappings: [],
      records: [],
      // Org's CAE-3 not in the list.
      cae3: "620",
    });
    expect(result.rows).toHaveLength(0);
    expect(result.counts.total).toBe(0);
  });

  it("non-applicable datapoint is included when includeNonApplicable=true; applicable=false flagged", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-intensity", "esrs", { cae3List: ["351"] })],
      mappings: [],
      records: [],
      cae3: "620",
      includeNonApplicable: true,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.applicable).toBe(false);
    expect(result.rows[0]?.status).toBe("missing");
  });

  it("applicable datapoint for matching CAE-3 included regardless of toggle", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-intensity", "esrs", { cae3List: ["351"] })],
      mappings: [],
      records: [],
      cae3: "351",
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.applicable).toBe(true);
  });

  it("null CAE-3 is permissive: applicable=true even on cae3-list rules", () => {
    // INCOMPLETE-mode orgs see every row + the UI flags applicability
    // as unknown — better than silently hiding.
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [makeDp("esrs-e1-intensity", "esrs", { cae3List: ["351"] })],
      mappings: [],
      records: [],
      cae3: null,
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.applicable).toBe(true);
  });
});

// ── framework filtering ────────────────────────────────────────────

describe("calculateCoverage — framework filtering", () => {
  it("ignores datapoints from other frameworks even when present in the input set", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [
        makeDp("esrs-e1-1", "esrs"),
        makeDp("ghg-scope1", "ghg"),
        makeDp("gri-305-1", "gri"),
      ],
      mappings: [],
      records: [],
      cae3: "620",
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.datapoint.framework).toBe("esrs");
  });
});

// ── counts summary ─────────────────────────────────────────────────

describe("calculateCoverage — counts summary", () => {
  it("counts reflect the applicability-filtered output", () => {
    const result = calculateCoverage({
      framework: "esrs",
      datapoints: [
        makeDp("esrs-a"),
        makeDp("esrs-b"),
        makeDp("esrs-c"),
        makeDp("esrs-energy", "esrs", { cae3List: ["351"] }),
      ],
      mappings: [
        makeMapping("tpl-1", "esrs-a"),
        makeMapping("tpl-2", "esrs-b"),
      ],
      records: [makeRecord("rec-a", "tpl-1")],
      cae3: "620",
    });
    // esrs-a covered, esrs-b partial, esrs-c missing, esrs-energy
    // excluded (not applicable for cae3=620).
    expect(result.counts.covered).toBe(1);
    expect(result.counts.partial).toBe(1);
    expect(result.counts.missing).toBe(1);
    expect(result.counts.total).toBe(3);
  });
});
