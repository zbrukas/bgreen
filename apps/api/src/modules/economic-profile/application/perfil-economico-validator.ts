// PerfilEconomicoValidator — pure deep module.
//
// Ported from PRD #19 §19. The AI returns per-field confidence; this
// validator downgrades confidence when deterministic sanity checks fail.
// It never blocks the flow (the user can still confirm a LOW-confidence
// value) and never mutates the value — only the confidence label and a
// warnings list. The UI uses warnings to render yellow badges + tooltips.
//
// Design choices:
//   - All rules are independent. Multiple rules can fire on the same
//     profile; the warnings array preserves all of them.
//   - Year window is [1990, currentYear+1]. Lower bound is "older than
//     bGreen could plausibly serve"; upper bound allows next year for
//     extractions submitted late.
//   - EBITDA margin sanity uses |ebitda / turnover| > 5.0 (500%). Some
//     legitimate companies have crazy ratios (e.g., asset-light
//     consulting firms posting EBITDA > revenue once) but 500% is far
//     enough out to flag as suspect.
//   - Employee upper bound 10M — Walmart has ~2.1M globally; nothing on
//     a Portuguese IES will exceed this without being a parsing error.
//
// Pure. No I/O. Test surface ~10 cases.

import type {
  ExtractedEconomicProfile,
  ProfileField,
  ValidationResult,
  ValidatorRule,
  ValidatorWarning,
} from "../domain/types";

const EMPLOYEE_MAX = 10_000_000;
const EBITDA_MARGIN_CAP = 5.0;
const YEAR_FLOOR = 1990;
// Treated as relative to the current year — captured at call time so the
// validator stays pure (no module-level Date.now()).

interface ValidateOptions {
  // Override "now" for tests. Defaults to new Date().
  now?: Date;
}

export function validatePerfilEconomico(
  input: ExtractedEconomicProfile,
  options: ValidateOptions = {},
): ValidationResult {
  const now = options.now ?? new Date();
  const currentYear = now.getUTCFullYear();
  const warnings: ValidatorWarning[] = [];

  // Clone-then-downgrade: we never mutate the caller's object.
  const out: ExtractedEconomicProfile = {
    year: { ...input.year },
    employees: { ...input.employees },
    turnover: { ...input.turnover },
    ebitda: { ...input.ebitda },
    balanceSheetTotal: { ...input.balanceSheetTotal },
    cae: { ...input.cae },
  };

  // Helper: record a warning and downgrade the field's confidence to LOW.
  // Skips the downgrade if the value is null (missing_required's domain —
  // there's nothing to be uncertain about when there's no value) or if
  // confidence is already LOW (idempotent).
  //
  // The `as never` covers TS's inability to type the keyed write — `out[field]`
  // resolves to the intersection of all field types (= `never`), but we know
  // the read and write are the same field by construction.
  const flag = (field: ProfileField | null, rule: ValidatorRule, message: string): void => {
    warnings.push({ field, rule, message });
    if (field === null) return;
    const current = out[field];
    if (current.value === null) return;
    if (current.confidence === "LOW") return;
    out[field] = { value: current.value, confidence: "LOW" } as never;
  };

  // Required-field presence. PRD #19 names year + employees + turnover as
  // the core trio. EBITDA / balance sheet are nice-to-have.
  if (out.year.value === null) {
    flag("year", "missing_required", "Ano de exercício em falta.");
  }
  if (out.employees.value === null) {
    flag("employees", "missing_required", "Número de colaboradores em falta.");
  }
  if (out.turnover.value === null) {
    flag("turnover", "missing_required", "Volume de negócios em falta.");
  }

  // Year window. Skip if missing — already flagged above.
  if (out.year.value !== null) {
    if (out.year.value < YEAR_FLOOR) {
      flag("year", "year_too_old", `Ano (${out.year.value}) é demasiado antigo.`);
    } else if (out.year.value > currentYear + 1) {
      flag("year", "year_future", `Ano (${out.year.value}) está no futuro.`);
    }
  }

  // Employees range. Negative is always nonsense; > 10M is parser fail.
  if (out.employees.value !== null) {
    if (out.employees.value < 0) {
      flag(
        "employees",
        "employees_negative",
        `Número de colaboradores negativo (${out.employees.value}).`,
      );
    } else if (out.employees.value > EMPLOYEE_MAX) {
      flag(
        "employees",
        "employees_implausible",
        `Número de colaboradores improvável (${out.employees.value}).`,
      );
    }
  }

  // Turnover non-negative.
  if (out.turnover.value !== null && out.turnover.value < 0) {
    flag(
      "turnover",
      "turnover_negative",
      `Volume de negócios negativo (${out.turnover.value}).`,
    );
  }

  // Balance sheet non-negative.
  if (out.balanceSheetTotal.value !== null && out.balanceSheetTotal.value < 0) {
    flag(
      "balanceSheetTotal",
      "balance_sheet_negative",
      `Ativo total negativo (${out.balanceSheetTotal.value}).`,
    );
  }

  // EBITDA margin sanity. Skip if either is null, or turnover is exactly
  // zero (any margin is well-defined as "implausible" but the message
  // would be misleading — flag missing_required separately, not here).
  if (
    out.ebitda.value !== null &&
    out.turnover.value !== null &&
    out.turnover.value !== 0
  ) {
    const ratio = Math.abs(out.ebitda.value / out.turnover.value);
    if (ratio > EBITDA_MARGIN_CAP) {
      flag(
        "ebitda",
        "ebitda_implausible_margin",
        `Margem EBITDA improvável (${(ratio * 100).toFixed(0)}%).`,
      );
    }
  }

  return { profile: out, warnings };
}
