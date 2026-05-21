// Shared event + context shapes used by every record workflow graph.
//
// Keeping these in one place means the WorkflowEngine can speak to any
// graph through a uniform API: send an event, get a new state. Each
// graph decides which events it accepts.

export interface WorkflowContext {
  // User who first submitted the record. Set when the machine leaves
  // its initial `draft` state. Required by guards that prevent
  // self-review/self-certify.
  submitterUserId: string | null;
  // User who approved the record. Set on the `approve` transition.
  // three-step-certify uses this to prevent the reviewer from
  // certifying their own approval.
  reviewerUserId: string | null;
}

export type WorkflowEvent =
  | { type: "submit"; actorUserId: string; comment?: string | null }
  | { type: "approve"; actorUserId: string; comment?: string | null }
  | { type: "request_changes"; actorUserId: string; comment: string }
  | { type: "reject"; actorUserId: string; comment: string }
  | { type: "certify"; actorUserId: string; comment?: string | null };

export type WorkflowEventType = WorkflowEvent["type"];

export const initialContext: WorkflowContext = {
  submitterUserId: null,
  reviewerUserId: null,
};

export type WorkflowDefinitionId = "single-step-submit" | "two-step-review" | "three-step-certify";
