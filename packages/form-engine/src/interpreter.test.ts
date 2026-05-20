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
});
