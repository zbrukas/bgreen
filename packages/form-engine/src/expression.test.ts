import { describe, expect, it } from "vitest";
import { collectReferences, evaluateExpression, parseExpression } from "./expression";

function parseOk(src: string) {
  const r = parseExpression(src);
  if (!r.ok) throw new Error(`expected parse to succeed for "${src}": ${r.message}`);
  return r.ast;
}

describe("parseExpression", () => {
  it("parses numbers including underscores and decimals", () => {
    expect(parseOk("123")).toEqual({ type: "number", value: 123 });
    expect(parseOk("12.5")).toEqual({ type: "number", value: 12.5 });
    expect(parseOk("1_000")).toEqual({ type: "number", value: 1000 });
  });

  it("parses identifiers", () => {
    expect(parseOk("kwh")).toEqual({ type: "ref", id: "kwh" });
    expect(parseOk("kwh_consumo")).toEqual({ type: "ref", id: "kwh_consumo" });
  });

  it("respects operator precedence", () => {
    const ast = parseOk("a + b * c");
    expect(ast).toEqual({
      type: "binary",
      op: "+",
      left: { type: "ref", id: "a" },
      right: {
        type: "binary",
        op: "*",
        left: { type: "ref", id: "b" },
        right: { type: "ref", id: "c" },
      },
    });
  });

  it("handles parentheses overriding precedence", () => {
    expect(evaluateExpression(parseOk("(a + b) * c"), { a: 2, b: 3, c: 4 })).toEqual({
      ok: true,
      value: 20,
    });
  });

  it("handles unary minus", () => {
    expect(evaluateExpression(parseOk("-a + 5"), { a: 3 })).toEqual({ ok: true, value: 2 });
  });

  it("rejects trailing junk", () => {
    const r = parseExpression("a + b )");
    expect(r.ok).toBe(false);
  });

  it("rejects empty expressions", () => {
    expect(parseExpression("").ok).toBe(false);
  });

  it("rejects unsupported characters", () => {
    expect(parseExpression("a ^ b").ok).toBe(false);
    expect(parseExpression("a && b").ok).toBe(false);
  });
});

describe("evaluateExpression", () => {
  it("computes CO2e-style formulas", () => {
    const ast = parseOk("activity * factor");
    expect(evaluateExpression(ast, { activity: 100, factor: 0.5 })).toEqual({
      ok: true,
      value: 50,
    });
  });

  it("coerces PT-locale string numbers from values", () => {
    const ast = parseOk("a * 2");
    expect(evaluateExpression(ast, { a: "12,5" })).toEqual({ ok: true, value: 25 });
  });

  it("flags missing dependency when value absent", () => {
    const r = evaluateExpression(parseOk("a + b"), { a: 1 });
    expect(r).toEqual({ ok: false, error: { code: "missing_dependency", refId: "b" } });
  });

  it("flags missing dependency when value is empty string", () => {
    const r = evaluateExpression(parseOk("a"), { a: "" });
    expect(r).toEqual({ ok: false, error: { code: "missing_dependency", refId: "a" } });
  });

  it("flags non-numeric dependency", () => {
    const r = evaluateExpression(parseOk("a + 1"), { a: "abc" });
    expect(r).toEqual({ ok: false, error: { code: "non_numeric_dependency", refId: "a" } });
  });

  it("flags division by zero", () => {
    const r = evaluateExpression(parseOk("a / b"), { a: 10, b: 0 });
    expect(r).toEqual({ ok: false, error: { code: "division_by_zero" } });
  });
});

describe("collectReferences", () => {
  it("returns the set of field ids referenced", () => {
    expect(collectReferences(parseOk("a + b * (c - 5)"))).toEqual(new Set(["a", "b", "c"]));
  });

  it("returns empty set for literal-only expressions", () => {
    expect(collectReferences(parseOk("2 + 3"))).toEqual(new Set());
  });
});
