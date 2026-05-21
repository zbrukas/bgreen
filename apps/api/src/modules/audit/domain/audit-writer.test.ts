import { describe, expect, it } from "vitest";
import { buildEntityDiff, buildWorkflowTransition } from "./audit-writer.js";

describe("buildEntityDiff", () => {
  it("treats null before as an insert (every field is 'changed')", () => {
    const diff = buildEntityDiff(null, { name: "Foo", count: 3 });
    expect(diff.changedFields).toEqual(["count", "name"]);
    expect(diff.before).toBe(null);
    expect(diff.after).toEqual({ name: "Foo", count: 3 });
  });

  it("treats null after as a delete", () => {
    const diff = buildEntityDiff({ name: "Foo" }, null);
    expect(diff.changedFields).toEqual(["name"]);
    expect(diff.before).toEqual({ name: "Foo" });
    expect(diff.after).toBe(null);
  });

  it("lists only the changed keys on an update", () => {
    const diff = buildEntityDiff(
      { name: "Foo", count: 3, active: true },
      { name: "Foo", count: 4, active: true },
    );
    expect(diff.changedFields).toEqual(["count"]);
  });

  it("normalises Date instances against ISO strings", () => {
    const d = new Date("2026-05-21T00:00:00Z");
    const diff = buildEntityDiff({ at: d }, { at: "2026-05-21T00:00:00.000Z" });
    expect(diff.changedFields).toEqual([]);
  });

  it("recurses into objects + arrays for structural equality", () => {
    const same = buildEntityDiff({ values: { a: 1, b: [1, 2] } }, { values: { a: 1, b: [1, 2] } });
    expect(same.changedFields).toEqual([]);

    const different = buildEntityDiff(
      { values: { a: 1, b: [1, 2] } },
      { values: { a: 1, b: [1, 3] } },
    );
    expect(different.changedFields).toEqual(["values"]);
  });

  it("flags added/removed keys as changes", () => {
    const diff = buildEntityDiff({ a: 1 }, { a: 1, b: 2 });
    expect(diff.changedFields).toEqual(["b"]);
  });

  it("returns empty diff when both sides are null", () => {
    expect(buildEntityDiff(null, null)).toEqual({
      changedFields: [],
      before: null,
      after: null,
    });
  });
});

describe("buildWorkflowTransition", () => {
  it("normalises a workflow transition payload, defaulting comment to null", () => {
    expect(
      buildWorkflowTransition({ event: "submit", fromState: "draft", toState: "submitted" }),
    ).toEqual({ event: "submit", fromState: "draft", toState: "submitted", comment: null });
  });

  it("preserves comment when provided", () => {
    expect(
      buildWorkflowTransition({
        event: "request_changes",
        fromState: "submitted",
        toState: "changes_requested",
        comment: "Faltam dados de CO2.",
      }).comment,
    ).toBe("Faltam dados de CO2.");
  });
});
