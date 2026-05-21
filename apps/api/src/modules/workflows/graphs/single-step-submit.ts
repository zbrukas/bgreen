import { assign, setup } from "xstate";
import { type WorkflowContext, type WorkflowEvent, initialContext } from "./types.js";

// Single-step-submit — no review. Submit the draft and it becomes
// authoritative. The `submitted` state is terminal. Used for templates
// where the act of submission is also the act of finalisation.
export const singleStepSubmit = setup({
  types: {
    context: {} as WorkflowContext,
    events: {} as WorkflowEvent,
  },
}).createMachine({
  id: "single-step-submit",
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
    submitted: { type: "final" },
  },
});
