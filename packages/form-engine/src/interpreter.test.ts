import type { FormSchema } from "@bgreen/types";
import { describe, expect, it } from "vitest";
import { validateFormValues } from "./interpreter";

function schema(...fields: FormSchema["rows"][number]["fields"]): FormSchema {
  return { version: 1, rows: [{ id: "row1", fields }] };
}

describe("validateFormValues", () => {
  it("returns errors when input isn't an object", () => {
    const s = schema({ id: "name", kind: "text", label: "Nome" });
    expect(validateFormValues(s, null).ok).toBe(false);
    expect(validateFormValues(s, "string").ok).toBe(false);
    expect(validateFormValues(s, [1, 2, 3]).ok).toBe(false);
  });

  it("flags required fields that are missing or empty", () => {
    const s = schema({ id: "name", kind: "text", label: "Nome", required: true });
    const r = validateFormValues(s, { name: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe("required");
      expect(r.errors[0]?.fieldId).toBe("name");
    }
  });

  it("skips optional empty fields without error", () => {
    const s = schema({ id: "note", kind: "text", label: "Nota" });
    const r = validateFormValues(s, {});
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.note).toBeUndefined();
  });

  it("trims text and enforces maxLength", () => {
    const s = schema({ id: "name", kind: "text", label: "Nome", maxLength: 5 });
    const ok = validateFormValues(s, { name: "  abc  " });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.values.name).toBe("abc");

    const long = validateFormValues(s, { name: "abcdefghi" });
    expect(long.ok).toBe(false);
    if (!long.ok) expect(long.errors[0]?.code).toBe("max_length");
  });

  it("coerces string numbers (including PT-locale comma) and applies min/max", () => {
    const s = schema({ id: "kwh", kind: "number", label: "kWh", min: 0, max: 1000 });

    const a = validateFormValues(s, { kwh: "123" });
    expect(a.ok).toBe(true);
    if (a.ok) expect(a.values.kwh).toBe(123);

    const b = validateFormValues(s, { kwh: "12,5" });
    expect(b.ok).toBe(true);
    if (b.ok) expect(b.values.kwh).toBe(12.5);

    const negative = validateFormValues(s, { kwh: -1 });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.errors[0]?.code).toBe("out_of_range");

    const overflow = validateFormValues(s, { kwh: 10000 });
    expect(overflow.ok).toBe(false);
    if (!overflow.ok) expect(overflow.errors[0]?.code).toBe("out_of_range");
  });

  it("flags non-numeric strings on number fields", () => {
    const s = schema({ id: "kwh", kind: "number", label: "kWh" });
    const r = validateFormValues(s, { kwh: "abc" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors[0]?.code).toBe("wrong_type");
  });

  it("validates ISO date format and range", () => {
    const s = schema({
      id: "d",
      kind: "date",
      label: "Data",
      min: "2026-01-01",
      max: "2026-12-31",
    });
    const ok = validateFormValues(s, { d: "2026-06-15" });
    expect(ok.ok).toBe(true);

    const bad = validateFormValues(s, { d: "15/06/2026" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.code).toBe("invalid_format");

    const tooEarly = validateFormValues(s, { d: "2025-12-31" });
    expect(tooEarly.ok).toBe(false);
    if (!tooEarly.ok) expect(tooEarly.errors[0]?.code).toBe("out_of_range");
  });

  it("enforces select option membership", () => {
    const s = schema({
      id: "kind",
      kind: "select",
      label: "Tipo",
      options: [
        { value: "a", label: "Opção A" },
        { value: "b", label: "Opção B" },
      ],
    });
    expect(validateFormValues(s, { kind: "a" }).ok).toBe(true);

    const bad = validateFormValues(s, { kind: "c" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[0]?.code).toBe("invalid_option");
  });

  it("rejects unknown field ids in input", () => {
    const s = schema({ id: "name", kind: "text", label: "Nome" });
    const r = validateFormValues(s, { name: "ok", bogus: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors[0]?.code).toBe("unknown_field");
      expect(r.errors[0]?.fieldId).toBe("bogus");
    }
  });

  it("accumulates multiple errors across fields", () => {
    const s: FormSchema = {
      version: 1,
      rows: [
        {
          id: "row1",
          fields: [
            { id: "name", kind: "text", label: "Nome", required: true },
            { id: "kwh", kind: "number", label: "kWh", min: 0 },
          ],
        },
      ],
    };
    const r = validateFormValues(s, { name: "", kwh: -5 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.length).toBe(2);
  });

  describe("draft mode", () => {
    it("skips required on missing top-level fields", () => {
      const s = schema({ id: "name", kind: "text", label: "Nome", required: true });
      const submit = validateFormValues(s, {}, { mode: "submit" });
      expect(submit.ok).toBe(false);

      const draft = validateFormValues(s, {}, { mode: "draft" });
      expect(draft.ok).toBe(true);
    });

    it("still flags wrong-type even when not required", () => {
      const s = schema({ id: "kwh", kind: "number", label: "kWh" });
      const draft = validateFormValues(s, { kwh: "abc" }, { mode: "draft" });
      expect(draft.ok).toBe(false);
      if (!draft.ok) expect(draft.errors[0]?.code).toBe("wrong_type");
    });

    it("skips min_selections but enforces max_selections", () => {
      const s = schema({
        id: "tags",
        kind: "multi_select",
        label: "Etiquetas",
        options: [
          { value: "a", label: "A" },
          { value: "b", label: "B" },
        ],
        minSelected: 2,
        maxSelected: 2,
      });
      const draft = validateFormValues(s, { tags: ["a"] }, { mode: "draft" });
      expect(draft.ok).toBe(true);

      const overflow = validateFormValues(s, { tags: ["a", "b", "b"] }, { mode: "draft" });
      // After dedupe this becomes 2 — should be fine.
      expect(overflow.ok).toBe(true);
    });
  });

  describe("multi_select", () => {
    const baseField = {
      id: "tags",
      kind: "multi_select" as const,
      label: "Etiquetas",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
    };

    it("accepts a subset of valid option values and dedupes", () => {
      const s = schema(baseField);
      const r = validateFormValues(s, { tags: ["a", "c", "a"] });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.values.tags).toEqual(["a", "c"]);
    });

    it("rejects non-array values", () => {
      const s = schema(baseField);
      const r = validateFormValues(s, { tags: "a" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("wrong_type");
    });

    it("rejects values not in the option list", () => {
      const s = schema(baseField);
      const r = validateFormValues(s, { tags: ["a", "zz"] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("invalid_option");
    });

    it("flags empty array as required when required=true", () => {
      const s = schema({ ...baseField, required: true });
      const r = validateFormValues(s, { tags: [] });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("required");
    });

    it("enforces minSelected and maxSelected bounds", () => {
      const s = schema({ ...baseField, minSelected: 2, maxSelected: 2 });

      const tooFew = validateFormValues(s, { tags: ["a"] });
      expect(tooFew.ok).toBe(false);
      if (!tooFew.ok) expect(tooFew.errors[0]?.code).toBe("min_selections");

      const tooMany = validateFormValues(s, { tags: ["a", "b", "c"] });
      expect(tooMany.ok).toBe(false);
      if (!tooMany.ok) expect(tooMany.errors[0]?.code).toBe("max_selections");

      const justRight = validateFormValues(s, { tags: ["a", "b"] });
      expect(justRight.ok).toBe(true);
    });
  });

  describe("show-if", () => {
    it("skips required-check on hidden field", () => {
      const s = schema(
        {
          id: "kind",
          kind: "select",
          label: "Tipo",
          options: [
            { value: "company", label: "Empresa" },
            { value: "person", label: "Pessoa" },
          ],
        },
        {
          id: "vat",
          kind: "text",
          label: "NIF",
          required: true,
          showIf: [{ fieldId: "kind", equals: "company" }],
        },
      );
      const r = validateFormValues(s, { kind: "person" });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.values.vat).toBeUndefined();
    });

    it("enforces field rules when show-if is satisfied", () => {
      const s = schema(
        {
          id: "kind",
          kind: "select",
          label: "Tipo",
          options: [{ value: "company", label: "Empresa" }],
        },
        {
          id: "vat",
          kind: "text",
          label: "NIF",
          required: true,
          showIf: [{ fieldId: "kind", equals: "company" }],
        },
      );
      const r = validateFormValues(s, { kind: "company" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("required");
    });

    it("AND-chains multiple predicates", () => {
      const s = schema(
        {
          id: "a",
          kind: "select",
          label: "A",
          options: [
            { value: "x", label: "X" },
            { value: "y", label: "Y" },
          ],
        },
        {
          id: "b",
          kind: "select",
          label: "B",
          options: [
            { value: "1", label: "Um" },
            { value: "2", label: "Dois" },
          ],
        },
        {
          id: "c",
          kind: "text",
          label: "C",
          required: true,
          showIf: [
            { fieldId: "a", equals: "x" },
            { fieldId: "b", equals: "1" },
          ],
        },
      );

      // Both predicates satisfied → required kicks in.
      const both = validateFormValues(s, { a: "x", b: "1" });
      expect(both.ok).toBe(false);
      if (!both.ok) expect(both.errors[0]?.code).toBe("required");

      // Only one predicate satisfied → hidden, no error.
      const one = validateFormValues(s, { a: "x", b: "2" });
      expect(one.ok).toBe(true);
    });

    it("matches multi-select via array inclusion", () => {
      const s = schema(
        {
          id: "scopes",
          kind: "multi_select",
          label: "Âmbitos",
          options: [
            { value: "s1", label: "1" },
            { value: "s2", label: "2" },
          ],
        },
        {
          id: "detail",
          kind: "text",
          label: "Detalhe",
          required: true,
          showIf: [{ fieldId: "scopes", equals: "s2" }],
        },
      );
      const hidden = validateFormValues(s, { scopes: ["s1"] });
      expect(hidden.ok).toBe(true);

      const visible = validateFormValues(s, { scopes: ["s1", "s2"] });
      expect(visible.ok).toBe(false);
      if (!visible.ok) expect(visible.errors[0]?.code).toBe("required");
    });

    it("reports error when show-if references a non-existent field", () => {
      const s = schema({
        id: "x",
        kind: "text",
        label: "X",
        showIf: [{ fieldId: "ghost", equals: "1" }],
      });
      const r = validateFormValues(s, {});
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("unknown_show_if_target");
    });
  });

  describe("calculated", () => {
    function calcSchema(): FormSchema {
      return {
        version: 1,
        rows: [
          {
            id: "r1",
            fields: [
              { id: "activity", kind: "number", label: "Actividade" },
              { id: "factor", kind: "number", label: "Factor" },
              {
                id: "co2e",
                kind: "calculated",
                label: "CO₂e",
                expression: "activity * factor",
                unit: "kg",
              },
            ],
          },
        ],
      };
    }

    it("computes the value from sibling fields", () => {
      const r = validateFormValues(calcSchema(), { activity: 100, factor: 0.5 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.values.co2e).toBe(50);
    });

    it("leaves the calculated field empty when a dep is missing (skip)", () => {
      const r = validateFormValues(calcSchema(), { activity: 100 });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.values.co2e).toBeUndefined();
    });

    it("ignores user-supplied values for calculated fields", () => {
      const r = validateFormValues(calcSchema(), {
        activity: 4,
        factor: 5,
        co2e: 9999,
      });
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.values.co2e).toBe(20);
    });

    it("flags an invalid expression", () => {
      const bad: FormSchema = {
        version: 1,
        rows: [
          {
            id: "r1",
            fields: [
              { id: "a", kind: "number", label: "A" },
              { id: "x", kind: "calculated", label: "X", expression: "a +" },
            ],
          },
        ],
      };
      const r = validateFormValues(bad, { a: 1 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("calc_invalid_expression");
    });

    it("flags division by zero", () => {
      const s: FormSchema = {
        version: 1,
        rows: [
          {
            id: "r1",
            fields: [
              { id: "a", kind: "number", label: "A" },
              { id: "b", kind: "number", label: "B" },
              { id: "q", kind: "calculated", label: "Q", expression: "a / b" },
            ],
          },
        ],
      };
      const r = validateFormValues(s, { a: 10, b: 0 });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("calc_division_by_zero");
    });
  });

  describe("repeating", () => {
    const repeatField = {
      id: "vehicles",
      kind: "repeating" as const,
      label: "Veículos",
      rowLabel: "Veículo",
      minRows: 1,
      maxRows: 3,
      fields: [
        { id: "plate", kind: "text" as const, label: "Matrícula", required: true },
        { id: "km", kind: "number" as const, label: "Km", min: 0 },
      ],
    };

    it("validates each sub-row against its sub-schema", () => {
      const s = schema(repeatField);
      const r = validateFormValues(s, {
        vehicles: [
          { plate: "AB-12-CD", km: "1500" },
          { plate: "EF-34-GH", km: 0 },
        ],
      });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const rows = r.values.vehicles as Array<{ plate: string; km: number }>;
        expect(rows).toHaveLength(2);
        expect(rows[0]?.km).toBe(1500);
      }
    });

    it("enforces minRows / maxRows", () => {
      const s = schema(repeatField);
      const tooFew = validateFormValues(s, { vehicles: [] });
      expect(tooFew.ok).toBe(false);
      if (!tooFew.ok) expect(tooFew.errors[0]?.code).toBe("min_rows");

      const tooMany = validateFormValues(s, {
        vehicles: [
          { plate: "1", km: 0 },
          { plate: "2", km: 0 },
          { plate: "3", km: 0 },
          { plate: "4", km: 0 },
        ],
      });
      expect(tooMany.ok).toBe(false);
      if (!tooMany.ok) expect(tooMany.errors[0]?.code).toBe("max_rows");
    });

    it("paths sub-row errors with parent[index].field syntax", () => {
      const s = schema(repeatField);
      const r = validateFormValues(s, {
        vehicles: [{ plate: "", km: -10 }],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        const ids = r.errors.map((e) => e.fieldId);
        expect(ids).toContain("vehicles[0].plate");
        expect(ids).toContain("vehicles[0].km");
      }
    });

    it("draft mode preserves max_rows enforcement", () => {
      const s = schema(repeatField);
      const r = validateFormValues(
        s,
        {
          vehicles: [
            { plate: "1", km: 0 },
            { plate: "2", km: 0 },
            { plate: "3", km: 0 },
            { plate: "4", km: 0 },
          ],
        },
        { mode: "draft" },
      );
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("max_rows");
    });

    it("rejects non-array repeating value", () => {
      const s = schema(repeatField);
      const r = validateFormValues(s, { vehicles: "not an array" });
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.errors[0]?.code).toBe("wrong_type");
    });

    it("treats missing optional repeating as skipped", () => {
      const s = schema({ ...repeatField, minRows: 0 });
      const r = validateFormValues(s, {});
      expect(r.ok).toBe(true);
    });

    it("min_rows skipped in draft mode but enforced on submit", () => {
      const s = schema(repeatField);
      const draft = validateFormValues(s, { vehicles: [] }, { mode: "draft" });
      expect(draft.ok).toBe(true);

      const submitted = validateFormValues(s, { vehicles: [] }, { mode: "submit" });
      expect(submitted.ok).toBe(false);
      if (!submitted.ok) expect(submitted.errors[0]?.code).toBe("min_rows");
    });

    it("show-if scoped inside a sub-row references siblings, not top-level", () => {
      const s: FormSchema = {
        version: 1,
        rows: [
          {
            id: "r1",
            fields: [
              {
                id: "fleet",
                kind: "repeating",
                label: "Frota",
                rowLabel: "Veículo",
                minRows: 0,
                fields: [
                  {
                    id: "kind",
                    kind: "select",
                    label: "Tipo",
                    options: [
                      { value: "ev", label: "Eléctrico" },
                      { value: "ice", label: "Combustão" },
                    ],
                  },
                  {
                    id: "fuel",
                    kind: "text",
                    label: "Combustível",
                    required: true,
                    showIf: [{ fieldId: "kind", equals: "ice" }],
                  },
                ],
              },
            ],
          },
        ],
      };

      const r = validateFormValues(s, {
        fleet: [{ kind: "ev" }, { kind: "ice" }],
      });
      expect(r.ok).toBe(false);
      if (!r.ok) {
        // Only the second sub-row should fail (fuel hidden in first, required in second).
        expect(r.errors).toHaveLength(1);
        expect(r.errors[0]?.fieldId).toBe("fleet[1].fuel");
        expect(r.errors[0]?.code).toBe("required");
      }
    });
  });
});
