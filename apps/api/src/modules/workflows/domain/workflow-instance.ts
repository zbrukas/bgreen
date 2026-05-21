import type { WorkflowContext, WorkflowDefinitionId } from "../graphs/index.js";

// Persistent shape of a workflow instance. v1 keeps the live machine
// state — XState's `value` and `context` — but not the actor history.
// Audit log carries the chronological story; this row only has to
// answer "what state am I in right now?".
export interface WorkflowInstance {
  id: string;
  organizationId: string;
  entityKind: "record";
  entityId: string;
  definitionId: WorkflowDefinitionId;
  definitionVersion: number;
  currentState: WorkflowState;
  context: WorkflowContext;
  createdAt: string;
  updatedAt: string;
}

// XState v5 `StateValue` is `string | StateValueMap`; we encode that
// shape directly here. v1 only uses atomic states (strings) but the type
// stays open for compound states later.
export type WorkflowState = string | { [key: string]: WorkflowState };
