import { assign, setup } from "xstate";
import { type WorkflowContext, type WorkflowEvent, initialContext } from "./types.js";

// Three-step-certify — adds a certification step after approval. Used
// when a third party (auditor / certifier) must sign off after the
// internal reviewer has approved the record.
//
// State chain:
//   draft → submitted → {approved → certified, changes_requested → submitted, rejected}
//
// Guards:
//   * approve / request_changes / reject: actor ≠ submitter.
//   * certify: actor ≠ submitter AND actor ≠ reviewer.
export const threeStepCertify = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent,
  },
  guards: {
    actorIsNotSubmitter: ({ context, event }) => context.submitterUserId !== event.actorUserId,
    actorIsNeitherSubmitterNorReviewer: ({ context, event }) =>
      context.submitterUserId !== event.actorUserId && context.reviewerUserId !== event.actorUserId,
  },
}).createMachine({
  id: "three-step-certify",
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
    approved: {
      on: {
        certify: {
          target: "certified",
          guard: "actorIsNeitherSubmitterNorReviewer",
        },
      },
    },
    certified: { type: "final" },
    rejected: { type: "final" },
  },
});
