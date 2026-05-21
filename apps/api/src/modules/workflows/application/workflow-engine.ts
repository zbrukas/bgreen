import type { AnyStateMachine } from "xstate";
import { createActor } from "xstate";
import type { WorkflowState } from "../domain/workflow-instance.js";
import {
  type WorkflowContext,
  type WorkflowDefinitionId,
  type WorkflowEvent,
  getDefinition,
  initialContext,
} from "../graphs/index.js";

// Result of `transition` — accepted means the state changed (or the
// graph at least visited the event); rejected means a guard blocked the
// event or the event was meaningless in the current state. Engine never
// throws — callers always get a typed result.
export type TransitionOutcome =
  | { ok: true; fromState: WorkflowState; toState: WorkflowState; context: WorkflowContext }
  | { ok: false; reason: "guard_failed" | "event_not_accepted"; currentState: WorkflowState };

export interface StartOutput {
  initialState: WorkflowState;
  context: WorkflowContext;
}

// WorkflowEngine wraps XState's actor primitive. The engine is stateless
// w.r.t. specific workflow instances — `transition` takes (definition,
// fromState, context, event) and returns the deterministic outcome. The
// service layer owns persistence between calls.
export class WorkflowEngine {
  start(definitionId: WorkflowDefinitionId): StartOutput {
    const machine = getDefinition(definitionId);
    const actor = createActor(machine);
    actor.start();
    const snapshot = actor.getSnapshot();
    return {
      initialState: snapshot.value as WorkflowState,
      context: snapshot.context as WorkflowContext,
    };
  }

  transition(input: {
    definitionId: WorkflowDefinitionId;
    fromState: WorkflowState;
    context: WorkflowContext;
    event: WorkflowEvent;
  }): TransitionOutcome {
    const machine = getDefinition(input.definitionId);
    // Restore the actor from the persisted snapshot so guards see the
    // exact context the previous transition left behind.
    const actor = createActor(machine, {
      snapshot: machine.resolveState({
        value: input.fromState,
        context: input.context,
      }),
    });
    actor.start();
    const before = actor.getSnapshot();

    // Don't try to send into a final state — XState logs a warning and
    // returns an unchanged snapshot anyway. Skip straight to the
    // "no transition" branch.
    if (before.status === "done") {
      return {
        ok: false,
        reason: "event_not_accepted",
        currentState: before.value as WorkflowState,
      };
    }

    actor.send(input.event);
    const after = actor.getSnapshot();

    if (before.value === after.value) {
      // State unchanged. Distinguish "the event isn't defined here at all"
      // from "the event is defined but a guard rejected it" by inspecting
      // the static machine config. Snapshot.can() collapses both cases.
      const defined = isEventDefinedForState(machine, input.fromState, input.event.type);
      return {
        ok: false,
        reason: defined ? "guard_failed" : "event_not_accepted",
        currentState: before.value as WorkflowState,
      };
    }
    return {
      ok: true,
      fromState: before.value as WorkflowState,
      toState: after.value as WorkflowState,
      context: after.context as WorkflowContext,
    };
  }

  // Convenience: the empty context every newly-created instance gets.
  newContext(): WorkflowContext {
    return { ...initialContext };
  }
}

// v1 only uses atomic states (string-valued `currentState`), so reading
// the static config's `states[name].on` map is enough. Extend if/when
// compound states show up.
function isEventDefinedForState(
  machine: AnyStateMachine,
  state: WorkflowState,
  eventType: string,
): boolean {
  if (typeof state !== "string") return false;
  const stateNode = machine.config.states?.[state] as { on?: Record<string, unknown> } | undefined;
  if (!stateNode?.on) return false;
  return eventType in stateNode.on;
}
