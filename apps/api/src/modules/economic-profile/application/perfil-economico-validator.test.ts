import { describe, expect, it } from "vitest";
import type { ExtractedEconomicProfile } from "../domain/types";
import { validatePerfilEconomico } from "./perfil-economico-validator";

// Test fixture: a plausible 2024 IES extraction at HIGH confidence. Tests
// mutate clones of this for individual scenarios.
function happyProfile(): ExtractedEconomicProfile {
  return {
    year: { value: 2024, confidence: "HIGH" },
    employees: { value: 42, confidence: "HIGH" },
    turnover: { value: 1_500_000, confidence: "HIGH" },
    ebitda: { value: 200_000, confidence: "HIGH" },
    balanceSheetTotal: { value: 800_000, confidence: "HIGH" },
    cae: { value: "62010", confidence: "HIGH" },
  };
}

// Fixed "now" so year-window rules are stable across CI runs.
const FROZEN_NOW = new Date("2026-05-23T00:00:00Z");

describe("validatePerfilEconomico", () => {
  it("happy path — all fields plausible, no warnings, confidence preserved", () => {
    const result = validatePerfilEconomico(happyProfile(), { now: FROZEN_NOW });
    expect(result.warnings).toEqual([]);
    expect(result.profile.year.confidence).toBe("HIGH");
    expect(result.profile.employees.confidence).toBe("HIGH");
    expect(result.profile.turnover.confidence).toBe("HIGH");
  });

  it("negative employees → LOW + employees_negative warning", () => {
    const input = happyProfile();
    input.employees.value = -5;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.profile.employees.confidence).toBe("LOW");
    expect(result.warnings.map((w) => w.rule)).toContain("employees_negative");
  });

  it("employees > 10M → LOW + employees_implausible warning", () => {
    const input = happyProfile();
    input.employees.value = 50_000_000;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.profile.employees.confidence).toBe("LOW");
    expect(result.warnings.map((w) => w.rule)).toContain("employees_implausible");
  });

  it("negative turnover → LOW + turnover_negative warning", () => {
    const input = happyProfile();
    input.turnover.value = -1000;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.profile.turnover.confidence).toBe("LOW");
    expect(result.warnings.map((w) => w.rule)).toContain("turnover_negative");
  });

  it("EBITDA margin > 500% → LOW on ebitda, not on turnover", () => {
    const input = happyProfile();
    // 600% margin: ebitda 6_000_000 against turnover 1_000_000.
    input.turnover.value = 1_000_000;
    input.ebitda.value = 6_000_000;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.profile.ebitda.confidence).toBe("LOW");
    expect(result.profile.turnover.confidence).toBe("HIGH");
    expect(result.warnings.map((w) => w.rule)).toContain("ebitda_implausible_margin");
  });

  it("EBITDA with zero turnover — skip ratio rule (don't divide by zero)", () => {
    const input = happyProfile();
    input.turnover.value = 0;
    input.ebitda.value = 100_000;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.warnings.map((w) => w.rule)).not.toContain("ebitda_implausible_margin");
    expect(result.profile.ebitda.confidence).toBe("HIGH");
  });

  it("year in the future → LOW + year_future warning", () => {
    const input = happyProfile();
    input.year.value = 2030;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.profile.year.confidence).toBe("LOW");
    expect(result.warnings.map((w) => w.rule)).toContain("year_future");
  });

  it("year before 1990 → LOW + year_too_old warning", () => {
    const input = happyProfile();
    input.year.value = 1985;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.profile.year.confidence).toBe("LOW");
    expect(result.warnings.map((w) => w.rule)).toContain("year_too_old");
  });

  it("missing required field — year null → missing_required warning, no downgrade (no value)", () => {
    const input = happyProfile();
    input.year.value = null;
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.warnings.map((w) => w.rule)).toContain("missing_required");
    // The field's confidence label is preserved — there's nothing to
    // downgrade since the value is null. The warning carries the signal.
    expect(result.profile.year.confidence).toBe("HIGH");
  });

  it("LOW confidence stays LOW (downgrade is idempotent)", () => {
    const input = happyProfile();
    input.employees.value = -1;
    input.employees.confidence = "LOW";
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(result.profile.employees.confidence).toBe("LOW");
  });

  it("multiple rules fire — all warnings collected, all flagged fields downgraded", () => {
    const input = happyProfile();
    input.employees.value = -1; // employees_negative
    input.turnover.value = -100; // turnover_negative
    input.year.value = 2050; // year_future
    const result = validatePerfilEconomico(input, { now: FROZEN_NOW });

    const rules = result.warnings.map((w) => w.rule);
    expect(rules).toContain("employees_negative");
    expect(rules).toContain("turnover_negative");
    expect(rules).toContain("year_future");
    expect(result.profile.employees.confidence).toBe("LOW");
    expect(result.profile.turnover.confidence).toBe("LOW");
    expect(result.profile.year.confidence).toBe("LOW");
  });

  it("does not mutate the input object", () => {
    const input = happyProfile();
    input.employees.value = -5;
    const snapshot = JSON.parse(JSON.stringify(input));
    validatePerfilEconomico(input, { now: FROZEN_NOW });
    expect(input).toEqual(snapshot);
  });
});
