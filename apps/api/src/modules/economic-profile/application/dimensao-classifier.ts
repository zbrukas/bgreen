// DimensaoClassifier — pure deterministic EU 2003/361/EC arithmetic.
//
// EU Recommendation 2003/361/EC defines the SME bands by two criteria
// applied jointly:
//   1) Head-count band (primary, hard ceiling).
//   2) Either turnover OR balance-sheet total ≤ the band ceiling (whichever
//      is more favourable to the company — only ONE financial criterion
//      needs to fit).
//
// If a company exceeds the head-count band → it's automatically in the
// next-higher band regardless of financials. If a company fits the
// head-count band but BOTH financial criteria exceed the ceiling → it's
// bumped up a band.
//
// Bands (EU 2003/361/EC Article 2):
//   - MICRO:    < 10 staff AND (turnover ≤ €2M OR balance ≤ €2M)
//   - PEQUENA:  < 50 staff AND (turnover ≤ €10M OR balance ≤ €10M)
//   - MEDIA:    < 250 staff AND (turnover ≤ €50M OR balance ≤ €43M)
//   - GRANDE:   anything beyond — ≥ 250 staff OR both financials exceed
//               MEDIA's ceiling.
//
// "Group rollup" (linked/partner enterprises in EU terms) requires
// aggregating staff + financials across the corporate group before
// classifying. We accept it as a boolean flag for now; V7.2+ might
// surface an aggregation UI.
//
// Pure. No I/O. ~15 test cases at every threshold + missing-input.

export type Dimensao = "micro" | "pequena" | "media" | "grande";

// Rule identifiers fired during classification. Stored on
// organization_economic_profiles.dimensao_rationale (jsonb) so the UI
// can reconstruct the explanation without re-running the classifier.
export type DimensaoRuleId =
  | "staff_under_10"
  | "staff_under_50"
  | "staff_under_250"
  | "staff_at_or_above_250"
  | "financials_below_micro_ceiling"
  | "financials_below_pequena_ceiling"
  | "financials_below_media_ceiling"
  | "financials_above_media_ceiling"
  | "bumped_up_due_to_financials"
  | "missing_employees"
  | "missing_financials"
  | "group_rollup_applied";

export interface DimensaoRuleEntry {
  rule: DimensaoRuleId;
  // pt-PT message rendered verbatim in the UI rationale list.
  message: string;
}

export interface DimensaoConfidence {
  // 'high' when both head-count and a financial criterion are clearly
  // on the same side of the boundary; 'medium' when only one input
  // is present; 'low' when no inputs at all (degenerate — we still
  // return micro as the default).
  level: "high" | "medium" | "low";
}

export interface ClassifyDimensaoInput {
  employees: number | null;
  turnover: number | null;
  balanceSheetTotal: number | null;
  // True when the company has linked/partner enterprises that should
  // be rolled up before classifying. Optional metadata for the
  // rationale; the actual aggregation must happen at the call site.
  isGroupRollup?: boolean;
}

export interface ClassifyDimensaoResult {
  dimensao: Dimensao;
  rationale: DimensaoRuleEntry[];
  confidence: DimensaoConfidence;
}

// Thresholds in human-readable form. Kept as constants so a future
// regulator change is a one-line edit.
const STAFF_MICRO = 10;
const STAFF_PEQUENA = 50;
const STAFF_GRANDE = 250;
const FIN_MICRO = 2_000_000;
const FIN_PEQUENA = 10_000_000;
const FIN_MEDIA_TURNOVER = 50_000_000;
const FIN_MEDIA_BALANCE = 43_000_000;

export function classifyDimensao(input: ClassifyDimensaoInput): ClassifyDimensaoResult {
  const rationale: DimensaoRuleEntry[] = [];
  const { employees, turnover, balanceSheetTotal } = input;

  if (input.isGroupRollup) {
    rationale.push({
      rule: "group_rollup_applied",
      message:
        "Os valores foram consolidados ao nível do grupo, somando empresas ligadas e parceiras.",
    });
  }

  // Degenerate path: nothing to classify on. We pick micro (the most
  // conservative default — no false claims of being a big company)
  // but flag confidence as low.
  if (employees === null && turnover === null && balanceSheetTotal === null) {
    rationale.push({
      rule: "missing_employees",
      message: "Não foi indicado o número de colaboradores nem valores financeiros.",
    });
    return { dimensao: "micro", rationale, confidence: { level: "low" } };
  }

  // Head-count band. Treat null employees as "unknown" — fall back to
  // financial criteria only.
  const staffBand: Dimensao | "unknown" = (() => {
    if (employees === null) return "unknown";
    if (employees >= STAFF_GRANDE) return "grande";
    if (employees >= STAFF_PEQUENA) return "media";
    if (employees >= STAFF_MICRO) return "pequena";
    return "micro";
  })();

  if (employees !== null) {
    if (employees >= STAFF_GRANDE) {
      rationale.push({
        rule: "staff_at_or_above_250",
        message: `Tem ${employees} colaboradores (≥ ${STAFF_GRANDE}).`,
      });
    } else if (employees >= STAFF_PEQUENA) {
      rationale.push({
        rule: "staff_under_250",
        message: `Tem ${employees} colaboradores (< ${STAFF_GRANDE}).`,
      });
    } else if (employees >= STAFF_MICRO) {
      rationale.push({
        rule: "staff_under_50",
        message: `Tem ${employees} colaboradores (< ${STAFF_PEQUENA}).`,
      });
    } else {
      rationale.push({
        rule: "staff_under_10",
        message: `Tem ${employees} colaboradores (< ${STAFF_MICRO}).`,
      });
    }
  } else {
    rationale.push({
      rule: "missing_employees",
      message: "Número de colaboradores em falta — banda determinada só por critérios financeiros.",
    });
  }

  // Financial criterion. Per EU 2003/361/EC the company qualifies for
  // a band when EITHER turnover OR balance sheet fits — only one need
  // satisfy the ceiling.
  const financialBand: Dimensao | "unknown" = (() => {
    if (turnover === null && balanceSheetTotal === null) return "unknown";
    // Fit the SMALLEST band that either criterion satisfies. A
    // company with turnover €1M and balance sheet €40M fits micro
    // (turnover ≤ €2M satisfies the micro ceiling), even though its
    // balance sheet is well into media.
    const turnoverBand = turnover === null ? null : turnoverToBand(turnover);
    const balanceBand = balanceSheetTotal === null ? null : balanceToBand(balanceSheetTotal);
    return smallestBand(turnoverBand, balanceBand);
  })();

  if (financialBand === "unknown") {
    rationale.push({
      rule: "missing_financials",
      message: "Volume de negócios e ativo total ausentes — banda determinada só pelo head-count.",
    });
  } else {
    rationale.push(financialRationale(financialBand, turnover, balanceSheetTotal));
  }

  // Combine. The EFFECTIVE band is the LARGER of the two when both are
  // known — head-count is a hard ceiling. When one input is missing, we
  // use the other.
  let dimensao: Dimensao;
  let bumped = false;
  if (staffBand !== "unknown" && financialBand !== "unknown") {
    dimensao = largerBand(staffBand, financialBand);
    bumped = financialBand !== staffBand && largerBand(staffBand, financialBand) !== staffBand;
  } else if (staffBand !== "unknown") {
    dimensao = staffBand;
  } else if (financialBand !== "unknown") {
    dimensao = financialBand;
  } else {
    // Unreachable — the early return above handles all-null. Defensive.
    dimensao = "micro";
  }

  if (bumped) {
    rationale.push({
      rule: "bumped_up_due_to_financials",
      message: `A empresa foi colocada na banda ${BAND_LABEL[dimensao]} porque os critérios financeiros excedem o teto do head-count.`,
    });
  }

  const level: DimensaoConfidence["level"] =
    employees !== null && (turnover !== null || balanceSheetTotal !== null)
      ? "high"
      : "medium";

  return { dimensao, rationale, confidence: { level } };
}

const BAND_LABEL: Record<Dimensao, string> = {
  micro: "MICRO",
  pequena: "PEQUENA",
  media: "MÉDIA",
  grande: "GRANDE",
};

const BAND_ORDER: Dimensao[] = ["micro", "pequena", "media", "grande"];

function largerBand(a: Dimensao, b: Dimensao): Dimensao {
  return BAND_ORDER.indexOf(a) > BAND_ORDER.indexOf(b) ? a : b;
}

function smallestBand(a: Dimensao | null, b: Dimensao | null): Dimensao {
  // Both nulls handled by caller. At least one is non-null here.
  if (a === null) {
    if (b === null) return "grande"; // unreachable
    return b;
  }
  if (b === null) return a;
  return BAND_ORDER.indexOf(a) < BAND_ORDER.indexOf(b) ? a : b;
}

function turnoverToBand(turnover: number): Dimensao {
  if (turnover <= FIN_MICRO) return "micro";
  if (turnover <= FIN_PEQUENA) return "pequena";
  if (turnover <= FIN_MEDIA_TURNOVER) return "media";
  return "grande";
}

function balanceToBand(balance: number): Dimensao {
  if (balance <= FIN_MICRO) return "micro";
  if (balance <= FIN_PEQUENA) return "pequena";
  if (balance <= FIN_MEDIA_BALANCE) return "media";
  return "grande";
}

function financialRationale(
  band: Dimensao,
  turnover: number | null,
  balanceSheetTotal: number | null,
): DimensaoRuleEntry {
  const eur = new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  });
  const parts: string[] = [];
  if (turnover !== null) parts.push(`volume de negócios de ${eur.format(turnover)}`);
  if (balanceSheetTotal !== null) parts.push(`ativo total de ${eur.format(balanceSheetTotal)}`);
  const phrase = parts.join(" e ");
  const rule =
    band === "micro"
      ? "financials_below_micro_ceiling"
      : band === "pequena"
        ? "financials_below_pequena_ceiling"
        : band === "media"
          ? "financials_below_media_ceiling"
          : "financials_above_media_ceiling";
  return {
    rule,
    message: `Os critérios financeiros (${phrase}) colocam-na na banda ${BAND_LABEL[band]}.`,
  };
}
