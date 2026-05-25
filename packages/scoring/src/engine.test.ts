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

  // ── Extended coverage ──────────────────────────────────────────────

  describe("repeating aggregate=max", () => {
    it("returns the best sub-row score", () => {
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
                aggregate: "max",
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
      ).toBe(9);
    });
  });

  describe("weight edge cases", () => {
    it("weight=0 excludes contribution from total but keeps the breakdown entry", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "scored_but_zeroed",
                label: "Excluído",
                kind: "select",
                weight: 0,
                options: [
                  { value: "yes", label: "Sim", score: 10 },
                  { value: "no", label: "Não", score: 0 },
                ],
              },
              {
                id: "counted",
                label: "Contado",
                kind: "select",
                options: [
                  { value: "yes", label: "Sim", score: 5 },
                  { value: "no", label: "Não", score: 0 },
                ],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, {
        scored_but_zeroed: "yes",
        counted: "yes",
      });
      expect(result?.total).toBe(5);
      // The weight=0 field still appears in the breakdown (raw=10) so the
      // UI can show "scored 10 but excluded by weight".
      expect(result?.breakdown).toHaveLength(2);
      const zeroed = result?.breakdown.find((b) => b.fieldId === "scored_but_zeroed");
      expect(zeroed).toEqual({
        fieldId: "scored_but_zeroed",
        raw: 10,
        weight: 0,
        weighted: 0,
      });
    });

    it("weight applies inside repeating sub-rows", () => {
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
                fields: [
                  {
                    id: "rating",
                    label: "Nota",
                    kind: "number",
                    weight: 2,
                    scoring: { kind: "linear", per: 1 },
                  },
                ],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      // Each sub-row contributes rating × weight=2. Default aggregate
      // is sum: (5×2) + (3×2) = 16.
      expect(computeScore(schema, { audits: [{ rating: 5 }, { rating: 3 }] })?.total).toBe(16);
    });
  });

  describe("multi_select edge cases", () => {
    it("empty selection → null (no breakdown entry)", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "perks",
                label: "Perks",
                kind: "multi_select",
                options: [{ value: "a", label: "A", score: 5 }],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, { perks: [] });
      expect(result?.breakdown).toEqual([]);
      expect(result?.total).toBe(0);
    });

    it("ignores selection values not in options[]", () => {
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
                ],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      // 'ghost' is not in options[]; engine skips it cleanly.
      const result = computeScore(schema, { perks: ["remote", "ghost"] });
      expect(result?.total).toBe(3);
    });

    it("selection with only score-less options → 0 (entry kept)", () => {
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
                  { value: "a", label: "A" },
                  { value: "b", label: "B" },
                ],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, { perks: ["a"] });
      expect(result?.breakdown).toHaveLength(1);
      expect(result?.breakdown[0]?.raw).toBe(0);
    });
  });

  describe("select edge cases", () => {
    it("value not in options[] → not scored", () => {
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
      const result = computeScore(schema, { answer: "maybe" });
      expect(result?.breakdown).toEqual([]);
    });

    it("option without score → contributes 0 (entry preserved)", () => {
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
                  { value: "yes", label: "Sim" },
                  { value: "no", label: "Não" },
                ],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, { answer: "yes" });
      expect(result?.breakdown).toHaveLength(1);
      expect(result?.breakdown[0]?.raw).toBe(0);
    });

    it("negative option score is accepted (admin penalty)", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "violation",
                label: "Violação",
                kind: "select",
                options: [
                  { value: "yes", label: "Sim", score: -20 },
                  { value: "no", label: "Não", score: 0 },
                ],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, { violation: "yes" });
      expect(result?.breakdown[0]?.raw).toBe(-20);
      // Total stays at -20 (no clamping to zero — admins who use
      // negatives know what they're doing).
      expect(result?.total).toBe(-20);
    });
  });

  describe("number edge cases", () => {
    it("non-number value → not scored", () => {
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
      expect(computeScore(schema, { n: "not a number" })?.breakdown).toEqual([]);
    });

    it("non-finite value (NaN, Infinity) → not scored", () => {
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
      expect(computeScore(schema, { n: Number.NaN })?.breakdown).toEqual([]);
      expect(computeScore(schema, { n: Number.POSITIVE_INFINITY })?.breakdown).toEqual([]);
    });

    it("number without scoring metadata → not scored", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "n",
                label: "n",
                kind: "number",
                // no scoring block
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      expect(computeScore(schema, { n: 100 })?.breakdown).toEqual([]);
    });

    it("linear with negative value works (admin penalty)", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "co2_emitted",
                label: "CO₂ emitido (t)",
                kind: "number",
                scoring: { kind: "linear", per: -1 },
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      expect(computeScore(schema, { co2_emitted: 30 })?.breakdown[0]?.raw).toBe(-30);
    });
  });

  describe("repeating edge cases", () => {
    it("empty array → not scored (no breakdown entry)", () => {
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
      expect(computeScore(schema, { audits: [] })?.breakdown).toEqual([]);
    });

    it("ignores non-object sub-rows (defensive)", () => {
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
      // Mix valid + invalid sub-rows; engine filters the trash without
      // throwing.
      const result = computeScore(schema, {
        audits: [{ rating: 5 }, null, "not-an-object", { rating: 3 }],
      });
      expect(result?.total).toBe(8);
    });

    it("sub-row showIf hides a sub-field for that row only", () => {
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
                    label: "Eficiência (só gás)",
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
          },
        ],
        STANDARD_BUCKETS,
      );
      // Row 1: gas + high → +10. Row 2: diesel + high → hidden, not scored.
      const result = computeScore(schema, {
        vehicles: [
          { fuel: "gas", gas_efficiency: "high" },
          { fuel: "diesel", gas_efficiency: "high" },
        ],
      });
      expect(result?.total).toBe(10);
    });
  });

  describe("showIf semantics", () => {
    it("multiple predicates AND together — all must match", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "country",
                label: "País",
                kind: "select",
                options: [
                  { value: "pt", label: "Portugal" },
                  { value: "es", label: "Espanha" },
                ],
              },
              {
                id: "sector",
                label: "Sector",
                kind: "select",
                options: [
                  { value: "energy", label: "Energia" },
                  { value: "other", label: "Outro" },
                ],
              },
              {
                id: "pt_energy_only",
                label: "Só PT-energia",
                kind: "select",
                showIf: [
                  { fieldId: "country", equals: "pt" },
                  { fieldId: "sector", equals: "energy" },
                ],
                options: [{ value: "yes", label: "Sim", score: 50 }],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      // PT + energy → shown, scored.
      expect(
        computeScore(schema, {
          country: "pt",
          sector: "energy",
          pt_energy_only: "yes",
        })?.total,
      ).toBe(50);
      // PT only → hidden, not scored.
      expect(
        computeScore(schema, {
          country: "pt",
          sector: "other",
          pt_energy_only: "yes",
        })?.total,
      ).toBe(0);
    });

    it("predicate referencing a missing sibling → field stays hidden", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "dependent",
                label: "Dependente",
                kind: "select",
                showIf: [{ fieldId: "missing_field", equals: "yes" }],
                options: [{ value: "x", label: "X", score: 10 }],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      expect(computeScore(schema, { dependent: "x" })?.total).toBe(0);
    });
  });

  describe("tier classification", () => {
    it("percent below every bucket's minPct → '—' (no implicit fallback)", () => {
      // Admin forgot to define a 0-floor bucket. The engine must not
      // misleadingly assign the lowest band.
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
        {
          maxScore: 100,
          buckets: [
            { minPct: 30, label: "B" },
            { minPct: 70, label: "A" },
          ],
        },
      );
      expect(computeScore(schema, { n: 10 })?.tier).toBe("—");
      expect(computeScore(schema, { n: 30 })?.tier).toBe("B");
    });

    it("buckets in unsorted admin order are sorted defensively", () => {
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
        {
          maxScore: 100,
          buckets: [
            { minPct: 80, label: "A" },
            { minPct: 0, label: "C" },
            { minPct: 50, label: "B" },
          ],
        },
      );
      expect(computeScore(schema, { n: 25 })?.tier).toBe("C");
      expect(computeScore(schema, { n: 60 })?.tier).toBe("B");
      expect(computeScore(schema, { n: 85 })?.tier).toBe("A");
    });

    it("single-bucket scoring — every value (above the floor) maps to it", () => {
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
        { maxScore: 100, buckets: [{ minPct: 0, label: "Done" }] },
      );
      expect(computeScore(schema, { n: 0 })?.tier).toBe("Done");
      expect(computeScore(schema, { n: 50 })?.tier).toBe("Done");
      expect(computeScore(schema, { n: 200 })?.tier).toBe("Done");
    });
  });

  describe("non-scored field kinds", () => {
    it("text/date/calculated fields never contribute to the score", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "note",
                label: "Nota",
                kind: "text",
              },
              {
                id: "when",
                label: "Quando",
                kind: "date",
              },
              {
                id: "computed",
                label: "Computado",
                kind: "calculated",
                expression: "10 + 5",
              },
              {
                id: "real",
                label: "Real",
                kind: "select",
                options: [{ value: "yes", label: "Sim", score: 3 }],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, {
        note: "lorem",
        when: "2024-01-01",
        computed: 15,
        real: "yes",
      });
      expect(result?.breakdown.map((b) => b.fieldId)).toEqual(["real"]);
      expect(result?.total).toBe(3);
    });
  });

  describe("breakdown ordering + determinism", () => {
    it("breakdown follows declaration order (row-by-row, field-by-field)", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "alpha",
                label: "Alpha",
                kind: "select",
                options: [{ value: "x", label: "X", score: 1 }],
              },
            ],
          },
          {
            id: "r2",
            fields: [
              {
                id: "beta",
                label: "Beta",
                kind: "select",
                options: [{ value: "x", label: "X", score: 2 }],
              },
              {
                id: "gamma",
                label: "Gamma",
                kind: "select",
                options: [{ value: "x", label: "X", score: 3 }],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, { alpha: "x", beta: "x", gamma: "x" });
      expect(result?.breakdown.map((b) => b.fieldId)).toEqual(["alpha", "beta", "gamma"]);
    });

    it("calling computeScore twice with the same inputs returns the same result", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "n",
                label: "n",
                kind: "number",
                scoring: {
                  kind: "thresholds",
                  thresholds: [
                    { upTo: 100, score: 0 },
                    { upTo: 10, score: 10 },
                    { upTo: 50, score: 5 },
                  ],
                },
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const a = computeScore(schema, { n: 30 });
      const b = computeScore(schema, { n: 30 });
      expect(a).toEqual(b);
    });
  });

  describe("mixed-field integration", () => {
    it("composes select + multi_select + number + repeating in one template", () => {
      const schema = schemaWith(
        [
          {
            id: "r1",
            fields: [
              {
                id: "policy",
                label: "Política ESG",
                kind: "select",
                options: [
                  { value: "yes", label: "Sim", score: 20 },
                  { value: "no", label: "Não", score: 0 },
                ],
              },
              {
                id: "certifications",
                label: "Certificações",
                kind: "multi_select",
                options: [
                  { value: "iso14001", label: "ISO 14001", score: 15 },
                  { value: "iso50001", label: "ISO 50001", score: 10 },
                  { value: "b_corp", label: "B Corp", score: 25 },
                ],
              },
              {
                id: "renewable_pct",
                label: "Energia renovável (%)",
                kind: "number",
                scoring: {
                  kind: "thresholds",
                  thresholds: [
                    { upTo: 20, score: 0 },
                    { upTo: 50, score: 10 },
                    { upTo: 100, score: 20 },
                  ],
                },
              },
              {
                id: "audits",
                label: "Auditorias",
                kind: "repeating",
                rowLabel: "Auditoria",
                aggregate: "sum",
                fields: [
                  {
                    id: "passed",
                    label: "Passou",
                    kind: "select",
                    options: [
                      { value: "yes", label: "Sim", score: 5 },
                      { value: "no", label: "Não", score: 0 },
                    ],
                  },
                ],
              },
            ],
          },
        ],
        STANDARD_BUCKETS,
      );
      const result = computeScore(schema, {
        policy: "yes", // 20
        certifications: ["iso14001", "b_corp"], // 15 + 25 = 40
        renewable_pct: 65, // ≤100 bucket → 20
        audits: [{ passed: "yes" }, { passed: "yes" }, { passed: "no" }], // 5+5+0 = 10
      });
      // Total 20 + 40 + 20 + 10 = 90 → capped at 100? maxScore is 100,
      // 90 fits → percent=90, tier=A (≥80).
      expect(result?.total).toBe(90);
      expect(result?.percent).toBe(90);
      expect(result?.tier).toBe("A");
      expect(result?.breakdown.map((b) => b.fieldId)).toEqual([
        "policy",
        "certifications",
        "renewable_pct",
        "audits",
      ]);
    });
  });
});
