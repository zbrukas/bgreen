import type { FormSchema, RecordValues } from "@bgreen/types";
import { describe, expect, it } from "vitest";
import { computeScore } from "./engine";

// Test helpers — build a minimally-valid schema around the field(s) under
// test. The interpreter normally validates the whole schema; we bypass
// that here because scoring doesn't require validation to have happened.

function schemaWith(
  rows: FormSchema["rows"],
  scoring?: FormSchema["scoring"],
): FormSchema {
  return { version: 1, rows, scoring };
}

const STANDARD_BUCKETS: NonNullable<FormSchema["scoring"]> = {
  maxScore: 100,
  buckets: [
    { minPct: 0, label: "C" },
    { minPct: 50, label: "B" },
    { minPct: 80, label: "A" },
  ],
};

describe("computeScore", () => {
  it("returns null when the template has no scoring metadata", () => {
    const schema = schemaWith([
      {
        id: "r1",
        fields: [
          {
            id: "answer",
            label: "Answer",
            kind: "select",
            options: [
              { value: "yes", label: "Sim", score: 10 },
              { value: "no", label: "Não", score: 0 },
            ],
          },
        ],
      },
    ]);
    expect(computeScore(schema, { answer: "yes" })).toBeNull();
  });

  it("select picks the option's score", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "answer",
              label: "Answer",
              kind: "select",
              options: [
                { value: "yes", label: "Sim", score: 10 },
                { value: "partial", label: "Em desenvolvimento", score: 5 },
                { value: "no", label: "Não", score: 0 },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const result = computeScore(schema, { answer: "partial" });
    expect(result?.total).toBe(5);
    expect(result?.percent).toBe(5);
    expect(result?.tier).toBe("C");
    expect(result?.breakdown).toEqual([
      { fieldId: "answer", raw: 5, weight: 1, weighted: 5 },
    ]);
  });

  it("multi_select sums scores of selected options", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "perks",
              label: "Perks",
              kind: "multi_select",
              options: [
                { value: "remote", label: "Remoto", score: 3 },
                { value: "training", label: "Formação", score: 5 },
                { value: "stock", label: "Ações", score: 7 },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const result = computeScore(schema, { perks: ["remote", "stock"] });
    expect(result?.total).toBe(10);
  });

  it("number/linear computes value × per", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "tonnes_recycled",
              label: "Toneladas recicladas",
              kind: "number",
              scoring: { kind: "linear", per: 0.5 },
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const result = computeScore(schema, { tonnes_recycled: 40 });
    expect(result?.total).toBe(20); // 40 × 0.5
  });

  it("number/thresholds picks the first matching upTo (sorted defensively)", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "energy_mwh",
              label: "Energia (MWh)",
              kind: "number",
              // Deliberately unordered to verify the engine sorts asc by upTo.
              scoring: {
                kind: "thresholds",
                thresholds: [
                  { upTo: 50, score: 5 },
                  { upTo: 10, score: 10 },
                  { upTo: 100, score: 0 },
                ],
              },
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    expect(computeScore(schema, { energy_mwh: 8 })?.total).toBe(10);
    expect(computeScore(schema, { energy_mwh: 30 })?.total).toBe(5);
    expect(computeScore(schema, { energy_mwh: 80 })?.total).toBe(0);
    // Above all thresholds → 0 (admin can add a sentinel for catch-all).
    expect(computeScore(schema, { energy_mwh: 500 })?.total).toBe(0);
  });

  it("repeating sums sub-row scores by default", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "vehicles",
              label: "Veículos",
              kind: "repeating",
              rowLabel: "Veículo",
              fields: [
                {
                  id: "type",
                  label: "Tipo",
                  kind: "select",
                  options: [
                    { value: "ev", label: "Elétrico", score: 10 },
                    { value: "petrol", label: "Combustão", score: 0 },
                  ],
                },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const values: RecordValues = {
      vehicles: [{ type: "ev" }, { type: "ev" }, { type: "petrol" }],
    };
    expect(computeScore(schema, values)?.total).toBe(20); // 10 + 10 + 0
  });

  it("repeating aggregate=avg averages sub-rows", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "suppliers",
              label: "Fornecedores",
              kind: "repeating",
              rowLabel: "Fornecedor",
              aggregate: "avg",
              fields: [
                {
                  id: "rating",
                  label: "Classificação",
                  kind: "number",
                  scoring: { kind: "linear", per: 1 },
                },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const values: RecordValues = {
      suppliers: [{ rating: 10 }, { rating: 6 }, { rating: 2 }],
    };
    expect(computeScore(schema, values)?.total).toBe(6); // (10+6+2)/3
  });

  it("repeating aggregate=min returns the worst sub-row", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "audits",
              label: "Auditorias",
              kind: "repeating",
              rowLabel: "Auditoria",
              aggregate: "min",
              fields: [
                {
                  id: "rating",
                  label: "Nota",
                  kind: "number",
                  scoring: { kind: "linear", per: 1 },
                },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    expect(
      computeScore(schema, { audits: [{ rating: 8 }, { rating: 3 }, { rating: 9 }] })?.total,
    ).toBe(3);
  });

  it("weight multiplies the field's contribution", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "policy",
              label: "Política",
              kind: "select",
              weight: 3,
              options: [
                { value: "yes", label: "Sim", score: 10 },
                { value: "no", label: "Não", score: 0 },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const result = computeScore(schema, { policy: "yes" });
    expect(result?.total).toBe(30); // 10 × 3
    expect(result?.breakdown[0]).toEqual({
      fieldId: "policy",
      raw: 10,
      weight: 3,
      weighted: 30,
    });
  });

  it("missing field value is skipped (no breakdown entry, no contribution)", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "answered",
              label: "Respondido",
              kind: "select",
              options: [
                { value: "yes", label: "Sim", score: 5 },
                { value: "no", label: "Não", score: 0 },
              ],
            },
            {
              id: "skipped",
              label: "Não respondido",
              kind: "select",
              options: [
                { value: "yes", label: "Sim", score: 10 },
                { value: "no", label: "Não", score: 0 },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const result = computeScore(schema, { answered: "yes" });
    expect(result?.total).toBe(5);
    expect(result?.breakdown).toHaveLength(1);
  });

  it("hidden field (showIf false) is skipped", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "fuel",
              label: "Combustível",
              kind: "select",
              options: [
                { value: "gas", label: "Gás", score: 0 },
                { value: "diesel", label: "Diesel", score: 0 },
              ],
            },
            {
              id: "gas_efficiency",
              label: "Eficiência (só se gás)",
              kind: "select",
              showIf: [{ fieldId: "fuel", equals: "gas" }],
              options: [
                { value: "high", label: "Alta", score: 10 },
                { value: "low", label: "Baixa", score: 0 },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    // gas_efficiency is hidden because fuel=diesel → not scored.
    const result = computeScore(schema, { fuel: "diesel", gas_efficiency: "high" });
    expect(result?.breakdown.find((b) => b.fieldId === "gas_efficiency")).toBeUndefined();
  });

  it("explicit zero is NOT skipped (breakdown entry preserved)", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "policy",
              label: "Política",
              kind: "select",
              options: [
                { value: "yes", label: "Sim", score: 10 },
                { value: "no", label: "Não", score: 0 },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const result = computeScore(schema, { policy: "no" });
    expect(result?.breakdown).toHaveLength(1);
    expect(result?.breakdown[0]?.raw).toBe(0);
    expect(result?.total).toBe(0);
  });

  it("bucket classification picks the highest minPct ≤ percent (boundaries)", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "n",
              label: "n",
              kind: "number",
              scoring: { kind: "linear", per: 1 },
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    expect(computeScore(schema, { n: 49 })?.tier).toBe("C");
    // 50 is the boundary — bucket B's minPct is 50.
    expect(computeScore(schema, { n: 50 })?.tier).toBe("B");
    expect(computeScore(schema, { n: 79 })?.tier).toBe("B");
    expect(computeScore(schema, { n: 80 })?.tier).toBe("A");
    expect(computeScore(schema, { n: 100 })?.tier).toBe("A");
  });

  it("total + percent are capped at maxScore / 100%", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "n",
              label: "n",
              kind: "number",
              scoring: { kind: "linear", per: 1 },
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    // Raw 500 exceeds maxScore 100 → total=100, percent=100, tier=A.
    const result = computeScore(schema, { n: 500 });
    expect(result?.total).toBe(100);
    expect(result?.percent).toBe(100);
    expect(result?.tier).toBe("A");
  });

  it("empty record produces total=0 with the lowest tier", () => {
    const schema = schemaWith(
      [
        {
          id: "r1",
          fields: [
            {
              id: "answer",
              label: "Answer",
              kind: "select",
              options: [
                { value: "yes", label: "Sim", score: 10 },
                { value: "no", label: "Não", score: 0 },
              ],
            },
          ],
        },
      ],
      STANDARD_BUCKETS,
    );
    const result = computeScore(schema, {});
    expect(result?.total).toBe(0);
    expect(result?.percent).toBe(0);
    expect(result?.tier).toBe("C");
    expect(result?.breakdown).toEqual([]);
  });
});
