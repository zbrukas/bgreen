import { assign, setup } from "xstate";
import { type WorkflowContext, type WorkflowEvent, initialContext } from "./types.js";

// Two-step-review — what V4.4 was implementing as a flat status field.
// Draft → submitted → {approved | changes_requested → submitted | rejected}.
// The reviewer must be someone other than the submitter (guard enforces
// the rule independently of any FGA role).
export const twoStepReview = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent,
  },
  guards: {
    actorIsNotSubmitter: ({ context, event }) => context.submitterUserId !== event.actorUserId,
  },
}).createMachine({
  id: "two-step-review",
  initial: "draft",
  context: initialContext,
  states: {
    draft: {
      on: {
        submit: {
          target: "submitted",
          actions: assign({
            submitterUserId: ({ context, event }) => context.submitterUserId ?? event.actorUserId,
          }),
        },
      },
    },
    submitted: {
      on: {
        approve: {
          target: "approved",
          guard: "actorIsNotSubmitter",
          actions: assign({
            reviewerUserId: ({ event }) => event.actorUserId,
          }),
        },
        request_changes: { target: "changes_requested", guard: "actorIsNotSubmitter" },
        reject: { target: "rejected", guard: "actorIsNotSubmitter" },
      },
    },
    changes_requested: {
      on: {
        submit: { target: "submitted" },
      },
    },
    approved: { type: "final" },
    rejected: { type: "final" },
  },
});
