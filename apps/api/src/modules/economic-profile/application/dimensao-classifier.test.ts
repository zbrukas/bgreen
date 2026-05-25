import { describe, expect, it } from "vitest";
import { classifyDimensao } from "./dimensao-classifier";

// EU Recommendation 2003/361/EC bands. Tests at every published
// threshold — boundary behaviour is the contract.

describe("classifyDimensao", () => {
  describe("clear-band cases (head-count + financials agree)", () => {
    it("9 staff, €1M turnover → micro", () => {
      const r = classifyDimensao({ employees: 9, turnover: 1_000_000, balanceSheetTotal: null });
      expect(r.dimensao).toBe("micro");
      expect(r.confidence.level).toBe("high");
    });

    it("32 staff, €4.8M turnover → pequena (canonical example from V7 plan)", () => {
      const r = classifyDimensao({
        employees: 32,
        turnover: 4_800_000,
        balanceSheetTotal: 3_200_000,
      });
      expect(r.dimensao).toBe("pequena");
      // Rationale mentions the head-count band + financial band.
      const messages = r.rationale.map((e) => e.message).join(" ");
      expect(messages).toContain("32 colaboradores");
      expect(messages.toLowerCase()).toContain("pequena");
    });

    it("120 staff, €30M turnover → media", () => {
      const r = classifyDimensao({
        employees: 120,
        turnover: 30_000_000,
        balanceSheetTotal: 25_000_000,
      });
      expect(r.dimensao).toBe("media");
    });

    it("500 staff, €120M turnover → grande", () => {
      const r = classifyDimensao({
        employees: 500,
        turnover: 120_000_000,
        balanceSheetTotal: 90_000_000,
      });
      expect(r.dimensao).toBe("grande");
    });
  });

  describe("EU thresholds — head-count", () => {
    it("9 vs 10 staff — pequena boundary (10 ≥ STAFF_MICRO)", () => {
      const nine = classifyDimensao({
        employees: 9,
        turnover: 5_000_000,
        balanceSheetTotal: null,
      });
      // 9 staff fits micro head-count but €5M turnover sits in pequena
      // → effective band is the LARGER, pequena.
      expect(nine.dimensao).toBe("pequena");

      const ten = classifyDimensao({
        employees: 10,
        turnover: 1_000_000,
        balanceSheetTotal: null,
      });
      // 10 staff is in the pequena head-count band.
      expect(ten.dimensao).toBe("pequena");
    });

    it("49 vs 50 staff — media boundary", () => {
      const r49 = classifyDimensao({
        employees: 49,
        turnover: 5_000_000,
        balanceSheetTotal: 5_000_000,
      });
      expect(r49.dimensao).toBe("pequena");

      const r50 = classifyDimensao({
        employees: 50,
        turnover: 5_000_000,
        balanceSheetTotal: 5_000_000,
      });
      expect(r50.dimensao).toBe("media");
    });

    it("249 vs 250 staff — grande boundary", () => {
      const r249 = classifyDimensao({
        employees: 249,
        turnover: 30_000_000,
        balanceSheetTotal: null,
      });
      expect(r249.dimensao).toBe("media");

      const r250 = classifyDimensao({
        employees: 250,
        turnover: 30_000_000,
        balanceSheetTotal: null,
      });
      expect(r250.dimensao).toBe("grande");
    });
  });

  describe("EU thresholds — financials", () => {
    it("€49.9M vs €50.1M turnover (with small staff) — financial bump to grande", () => {
      const under = classifyDimensao({
        employees: 100,
        turnover: 49_900_000,
        balanceSheetTotal: null,
      });
      expect(under.dimensao).toBe("media");

      // €50.1M turnover with no balance sheet → financials are above
      // media's ceiling on the only available criterion → bumped to
      // grande regardless of head-count.
      const over = classifyDimensao({
        employees: 100,
        turnover: 50_100_000,
        balanceSheetTotal: null,
      });
      expect(over.dimensao).toBe("grande");
      const ruleIds = over.rationale.map((e) => e.rule);
      expect(ruleIds).toContain("bumped_up_due_to_financials");
    });

    it("€43M vs €44M balance sheet (with small staff + low turnover via OR) — fits media", () => {
      // EU 2003/361/EC: company qualifies for a band when EITHER
      // financial criterion fits. Low turnover lets €44M balance
      // sheet still qualify the company for media.
      const r = classifyDimensao({
        employees: 100,
        turnover: 5_000_000,
        balanceSheetTotal: 44_000_000,
      });
      expect(r.dimensao).toBe("media");
    });
  });

  describe("missing-input fallbacks", () => {
    it("all inputs null → micro (conservative default) with low confidence", () => {
      const r = classifyDimensao({
        employees: null,
        turnover: null,
        balanceSheetTotal: null,
      });
      expect(r.dimensao).toBe("micro");
      expect(r.confidence.level).toBe("low");
    });

    it("only employees known — banding by head-count alone, medium confidence", () => {
      const r = classifyDimensao({ employees: 30, turnover: null, balanceSheetTotal: null });
      expect(r.dimensao).toBe("pequena");
      expect(r.confidence.level).toBe("medium");
    });

    it("only turnover known — banding by financials alone, medium confidence", () => {
      const r = classifyDimensao({ employees: null, turnover: 3_000_000, balanceSheetTotal: null });
      expect(r.dimensao).toBe("pequena");
      expect(r.confidence.level).toBe("medium");
    });
  });

  describe("group rollup", () => {
    it("flags the rollup in the rationale without changing the classification math", () => {
      const flat = classifyDimensao({
        employees: 100,
        turnover: 30_000_000,
        balanceSheetTotal: null,
      });
      const rolled = classifyDimensao({
        employees: 100,
        turnover: 30_000_000,
        balanceSheetTotal: null,
        isGroupRollup: true,
      });
      expect(rolled.dimensao).toBe(flat.dimensao);
      expect(rolled.rationale.map((e) => e.rule)).toContain("group_rollup_applied");
    });
  });
});
