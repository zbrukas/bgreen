import type { FormSchema } from "@bgreen/types";
import { describe, expect, it } from "vitest";
import { type ComposedSchema, validateComposedFormValues } from "./composed";

function schemaOf(...fields: FormSchema["rows"][number]["fields"]): FormSchema {
  return { version: 1, rows: [{ id: "row1", fields }] };
}

const SUB_HR = "11111111-1111-1111-1111-111111111111";
const SUB_ACCT = "22222222-2222-2222-2222-222222222222";

describe("validateComposedFormValues", () => {
  it("validates a composition with no sub-templates as if it were a plain schema", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "name", kind: "text", label: "Nome", required: true }),
      subTemplates: [],
    };
    const ok = validateComposedFormValues(composed, { name: "ACME" });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.values.name).toBe("ACME");
      expect(ok.values.subs).toBeUndefined();
    }
  });

  it("collects values from main + every declared sub-template under values.subs", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "year", kind: "number", label: "Ano" }),
      subTemplates: [
        { id: SUB_HR, schema: schemaOf({ id: "headcount", kind: "number", label: "Pessoas" }) },
        {
          id: SUB_ACCT,
          schema: schemaOf({ id: "revenue_eur", kind: "number", label: "Receita" }),
        },
      ],
    };
    const ok = validateComposedFormValues(composed, {
      year: 2025,
      subs: {
        [SUB_HR]: { headcount: 42 },
        [SUB_ACCT]: { revenue_eur: 1_250_000 },
      },
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.values.year).toBe(2025);
      expect(ok.values.subs?.[SUB_HR]).toEqual({ headcount: 42 });
      expect(ok.values.subs?.[SUB_ACCT]).toEqual({ revenue_eur: 1_250_000 });
    }
  });

  it("treats missing sub-template values as an empty object and still enforces required fields", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "year", kind: "number", label: "Ano", required: true }),
      subTemplates: [
        {
          id: SUB_HR,
          schema: schemaOf({ id: "headcount", kind: "number", label: "Pessoas", required: true }),
        },
      ],
    };
    const r = validateComposedFormValues(composed, { year: 2025 });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0]?.code).toBe("required");
      expect(r.errors[0]?.fieldId).toBe(`subs.${SUB_HR}.headcount`);
    }
  });

  it("skips required checks in draft mode for sub-template fields too", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "year", kind: "number", label: "Ano", required: true }),
      subTemplates: [
        {
          id: SUB_HR,
          schema: schemaOf({ id: "headcount", kind: "number", label: "Pessoas", required: true }),
        },
      ],
    };
    const r = validateComposedFormValues(composed, { year: 2025 }, { mode: "draft" });
    expect(r.ok).toBe(true);
  });

  it("flags unknown_field when input carries a sub-template id that isn't part of the composition", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "year", kind: "number", label: "Ano" }),
      subTemplates: [
        { id: SUB_HR, schema: schemaOf({ id: "headcount", kind: "number", label: "Pessoas" }) },
      ],
    };
    const r = validateComposedFormValues(composed, {
      year: 2025,
      subs: {
        [SUB_HR]: { headcount: 5 },
        [SUB_ACCT]: { revenue_eur: 99 },
      },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.find((e) => e.fieldId === `subs.${SUB_ACCT}`)?.code).toBe("unknown_field");
    }
  });

  it("rejects subs that isn't an object", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "year", kind: "number", label: "Ano" }),
      subTemplates: [
        { id: SUB_HR, schema: schemaOf({ id: "headcount", kind: "number", label: "Pessoas" }) },
      ],
    };
    const r = validateComposedFormValues(composed, { year: 2025, subs: "nope" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.find((e) => e.fieldId === "subs")?.code).toBe("wrong_type");
  });

  it("does not trip the unknown_field guard on the `subs` key when validating main", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "year", kind: "number", label: "Ano" }),
      subTemplates: [
        { id: SUB_HR, schema: schemaOf({ id: "headcount", kind: "number", label: "Pessoas" }) },
      ],
    };
    const r = validateComposedFormValues(composed, {
      year: 2025,
      subs: { [SUB_HR]: { headcount: 3 } },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.subs?.[SUB_HR]).toEqual({ headcount: 3 });
  });

  it("aggregates errors from main and every sub-template in declared order", () => {
    const composed: ComposedSchema = {
      main: schemaOf({ id: "year", kind: "number", label: "Ano", required: true }),
      subTemplates: [
        {
          id: SUB_HR,
          schema: schemaOf({ id: "headcount", kind: "number", label: "Pessoas", required: true }),
        },
        {
          id: SUB_ACCT,
          schema: schemaOf({
            id: "revenue_eur",
            kind: "number",
            label: "Receita",
            required: true,
          }),
        },
      ],
    };
    const r = validateComposedFormValues(composed, {});
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const paths = r.errors.map((e) => e.fieldId);
      expect(paths).toEqual(["year", `subs.${SUB_HR}.headcount`, `subs.${SUB_ACCT}.revenue_eur`]);
    }
  });
});
