import { singleStepSubmit } from "./single-step-submit.js";
import { threeStepCertify } from "./three-step-certify.js";
import { twoStepReview } from "./two-step-review.js";
import type { WorkflowDefinitionId } from "./types.js";

export {
  initialContext,
  type WorkflowContext,
  type WorkflowDefinitionId,
  type WorkflowEvent,
  type WorkflowEventType,
} from "./types.js";

export type AnyWorkflowMachine =
  | typeof singleStepSubmit
  | typeof twoStepReview
  | typeof threeStepCertify;

const registry: Record<WorkflowDefinitionId, AnyWorkflowMachine> = {
  "single-step-submit": singleStepSubmit,
  "two-step-review": twoStepReview,
  "three-step-certify": threeStepCertify,
};

export function getDefinition(id: WorkflowDefinitionId): AnyWorkflowMachine {
  const machine = registry[id];
  if (!machine) throw new Error(`Unknown workflow definition: ${id}`);
  return machine;
}

export function isWorkflowDefinitionId(value: string): value is WorkflowDefinitionId {
  return value in registry;
}

export const defaultWorkflowDefinitionId: WorkflowDefinitionId = "two-step-review";
