import { describe, expect, it } from "vitest";
import type { WorkflowDefinitionId, WorkflowEvent } from "../graphs/index.js";
import { WorkflowEngine } from "./workflow-engine.js";

const engine = new WorkflowEngine();

function startAndDrive(
  definitionId: WorkflowDefinitionId,
  events: WorkflowEvent[],
): { finalState: unknown; outcomes: unknown[] } {
  const { initialState, context } = engine.start(definitionId);
  let state: unknown = initialState;
  let ctx = context;
  const outcomes: unknown[] = [];
  for (const event of events) {
    const result = engine.transition({
      definitionId,
      fromState: state as never,
      context: ctx,
      event,
    });
    outcomes.push(result);
    if (result.ok) {
      state = result.toState;
      ctx = result.context;
    }
  }
  return { finalState: state, outcomes };
}

describe("single-step-submit", () => {
  it("starts in draft and reaches submitted on submit", () => {
    const { finalState } = startAndDrive("single-step-submit", [
      { type: "submit", actorUserId: "alice" },
    ]);
    expect(finalState).toBe("submitted");
  });

  it("rejects review events that don't exist in the graph", () => {
    const { outcomes } = startAndDrive("single-step-submit", [
      { type: "approve", actorUserId: "bob" },
    ]);
    expect(outcomes[0]).toMatchObject({ ok: false, reason: "event_not_accepted" });
  });
});

describe("two-step-review", () => {
  it("happy path: draft → submitted → approved", () => {
    const { finalState } = startAndDrive("two-step-review", [
      { type: "submit", actorUserId: "alice" },
      { type: "approve", actorUserId: "bob" },
    ]);
    expect(finalState).toBe("approved");
  });

  it("request_changes loops back to submitted", () => {
    const { finalState } = startAndDrive("two-step-review", [
      { type: "submit", actorUserId: "alice" },
      { type: "request_changes", actorUserId: "bob", comment: "Falta CO2" },
      { type: "submit", actorUserId: "alice" },
    ]);
    expect(finalState).toBe("submitted");
  });

  it("guards prevent the submitter from self-approving", () => {
    const { finalState, outcomes } = startAndDrive("two-step-review", [
      { type: "submit", actorUserId: "alice" },
      { type: "approve", actorUserId: "alice" },
    ]);
    expect(outcomes[1]).toMatchObject({ ok: false, reason: "guard_failed" });
    expect(finalState).toBe("submitted");
  });

  it("guards prevent the submitter from self-rejecting", () => {
    const { outcomes } = startAndDrive("two-step-review", [
      { type: "submit", actorUserId: "alice" },
      { type: "reject", actorUserId: "alice", comment: "no" },
    ]);
    expect(outcomes[1]).toMatchObject({ ok: false, reason: "guard_failed" });
  });

  it("rejects review events while still in draft", () => {
    const { outcomes } = startAndDrive("two-step-review", [
      { type: "approve", actorUserId: "alice" },
    ]);
    expect(outcomes[0]).toMatchObject({ ok: false, reason: "event_not_accepted" });
  });

  it("rejected is terminal — no further events accepted", () => {
    const { outcomes, finalState } = startAndDrive("two-step-review", [
      { type: "submit", actorUserId: "alice" },
      { type: "reject", actorUserId: "bob", comment: "rejeitado" },
      { type: "submit", actorUserId: "alice" },
    ]);
    expect(finalState).toBe("rejected");
    expect(outcomes[2]).toMatchObject({ ok: false, reason: "event_not_accepted" });
  });
});

describe("three-step-certify", () => {
  it("happy path: draft → submitted → approved → certified by a third user", () => {
    const { finalState } = startAndDrive("three-step-certify", [
      { type: "submit", actorUserId: "alice" },
      { type: "approve", actorUserId: "bob" },
      { type: "certify", actorUserId: "carol" },
    ]);
    expect(finalState).toBe("certified");
  });

  it("submitter cannot certify their own record", () => {
    const { outcomes } = startAndDrive("three-step-certify", [
      { type: "submit", actorUserId: "alice" },
      { type: "approve", actorUserId: "bob" },
      { type: "certify", actorUserId: "alice" },
    ]);
    expect(outcomes[2]).toMatchObject({ ok: false, reason: "guard_failed" });
  });

  it("reviewer cannot certify what they themselves approved", () => {
    const { outcomes } = startAndDrive("three-step-certify", [
      { type: "submit", actorUserId: "alice" },
      { type: "approve", actorUserId: "bob" },
      { type: "certify", actorUserId: "bob" },
    ]);
    expect(outcomes[2]).toMatchObject({ ok: false, reason: "guard_failed" });
  });

  it("rejects certify before approval", () => {
    const { outcomes } = startAndDrive("three-step-certify", [
      { type: "submit", actorUserId: "alice" },
      { type: "certify", actorUserId: "carol" },
    ]);
    expect(outcomes[1]).toMatchObject({ ok: false, reason: "event_not_accepted" });
  });

  it("supports the changes_requested round-trip same as two-step-review", () => {
    const { finalState } = startAndDrive("three-step-certify", [
      { type: "submit", actorUserId: "alice" },
      { type: "request_changes", actorUserId: "bob", comment: "missing" },
      { type: "submit", actorUserId: "alice" },
      { type: "approve", actorUserId: "bob" },
      { type: "certify", actorUserId: "carol" },
    ]);
    expect(finalState).toBe("certified");
  });
});

describe("engine APIs", () => {
  it("start returns the graph's initial state + empty context", () => {
    const { initialState, context } = engine.start("two-step-review");
    expect(initialState).toBe("draft");
    expect(context).toEqual({ submitterUserId: null, reviewerUserId: null });
  });

  it("transition reports event_not_accepted vs guard_failed accurately", () => {
    // event_not_accepted: send a review event from draft.
    const start = engine.start("two-step-review");
    const r1 = engine.transition({
      definitionId: "two-step-review",
      fromState: start.initialState,
      context: start.context,
      event: { type: "approve", actorUserId: "bob" },
    });
    expect(r1).toMatchObject({ ok: false, reason: "event_not_accepted" });

    // guard_failed: same event from submitted, but actor === submitter.
    const submitted = engine.transition({
      definitionId: "two-step-review",
      fromState: start.initialState,
      context: start.context,
      event: { type: "submit", actorUserId: "alice" },
    });
    expect(submitted.ok).toBe(true);
    if (!submitted.ok) return;
    const r2 = engine.transition({
      definitionId: "two-step-review",
      fromState: submitted.toState,
      context: submitted.context,
      event: { type: "approve", actorUserId: "alice" },
    });
    expect(r2).toMatchObject({ ok: false, reason: "guard_failed" });
  });
});
