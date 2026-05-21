import type { AuditService } from "../../audit/module.js";
import { buildWorkflowTransition } from "../../audit/module.js";
import type { WorkflowInstance, WorkflowState } from "../domain/workflow-instance.js";
import type {
  WorkflowContext,
  WorkflowDefinitionId,
  WorkflowEvent,
  WorkflowEventType,
} from "../graphs/index.js";
import { isWorkflowDefinitionId } from "../graphs/index.js";
import { WorkflowEngine } from "./workflow-engine.js";

export interface WorkflowRepository {
  insert(input: {
    organizationId: string;
    entityKind: "record";
    entityId: string;
    definitionId: WorkflowDefinitionId;
    definitionVersion: number;
    currentState: WorkflowState;
    context: WorkflowContext;
  }): Promise<WorkflowInstance>;
  updateState(input: {
    instanceId: string;
    currentState: WorkflowState;
    context: WorkflowContext;
  }): Promise<WorkflowInstance | null>;
  findForEntity(
    organizationId: string,
    entityKind: "record",
    entityId: string,
  ): Promise<WorkflowInstance | null>;
  listForOrganization(organizationId: string): Promise<WorkflowInstance[]>;
}

export type StartResult = { ok: true; instance: WorkflowInstance };

export type SendResult =
  | { ok: true; instance: WorkflowInstance }
  | {
      ok: false;
      code: "instance_not_found" | "event_not_accepted" | "guard_failed";
    };

export class WorkflowService {
  private readonly engine = new WorkflowEngine();

  constructor(
    private readonly repo: WorkflowRepository,
    private readonly audit: AuditService,
  ) {}

  async start(input: {
    organizationId: string;
    entityKind: "record";
    entityId: string;
    definitionId: WorkflowDefinitionId;
    actorUserId: string;
  }): Promise<StartResult> {
    if (!isWorkflowDefinitionId(input.definitionId)) {
      throw new Error(`Unknown workflow definition: ${input.definitionId}`);
    }
    const { initialState, context } = this.engine.start(input.definitionId);
    const instance = await this.repo.insert({
      organizationId: input.organizationId,
      entityKind: input.entityKind,
      entityId: input.entityId,
      definitionId: input.definitionId,
      definitionVersion: 1,
      currentState: initialState,
      context,
    });
    await this.audit.record({
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      entityKind: "workflow_instance",
      entityId: instance.id,
      action: "workflow.started",
      payload: { definitionId: input.definitionId, initialState },
    });
    return { ok: true, instance };
  }

  async send(input: {
    organizationId: string;
    entityKind: "record";
    entityId: string;
    event: WorkflowEvent;
  }): Promise<SendResult> {
    const instance = await this.repo.findForEntity(
      input.organizationId,
      input.entityKind,
      input.entityId,
    );
    if (!instance) return { ok: false, code: "instance_not_found" };

    const outcome = this.engine.transition({
      definitionId: instance.definitionId,
      fromState: instance.currentState,
      context: instance.context,
      event: input.event,
    });
    if (!outcome.ok) return { ok: false, code: outcome.reason };

    const updated = await this.repo.updateState({
      instanceId: instance.id,
      currentState: outcome.toState,
      context: outcome.context,
    });
    if (!updated) return { ok: false, code: "instance_not_found" };

    await this.audit.record({
      actorUserId: input.event.actorUserId,
      organizationId: input.organizationId,
      entityKind: "workflow_instance",
      entityId: instance.id,
      action: "workflow.transition",
      payload: buildWorkflowTransition({
        event: input.event.type,
        fromState: outcome.fromState,
        toState: outcome.toState,
        comment: extractComment(input.event),
      }),
    });
    return { ok: true, instance: updated };
  }

  getForEntity(
    organizationId: string,
    entityKind: "record",
    entityId: string,
  ): Promise<WorkflowInstance | null> {
    return this.repo.findForEntity(organizationId, entityKind, entityId);
  }

  listAll(organizationId: string): Promise<WorkflowInstance[]> {
    return this.repo.listForOrganization(organizationId);
  }

  // Returns workflow instances whose current state expects an action from
  // the signed-in user. Acts as v1's "pending my action" data source.
  // Until V5.3's FGA replaces this, the role check is the existing
  // membership role:
  //   * owner actions (edit drafts / resubmit after changes): the user
  //     who originally submitted the record.
  //   * reviewer actions (approve/request_changes/reject): admins on
  //     records they didn't submit, in "submitted" state.
  //   * certifier actions (three-step-certify only): admins on records
  //     they didn't submit OR review, in "approved" state.
  async listPendingForActor(
    organizationId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<WorkflowInstance[]> {
    const all = await this.repo.listForOrganization(organizationId);
    return all.filter((instance) => actionIsPending(instance, userId, isAdmin));
  }
}

function actionIsPending(instance: WorkflowInstance, userId: string, isAdmin: boolean): boolean {
  const state = typeof instance.currentState === "string" ? instance.currentState : null;
  if (!state) return false;

  if (state === "draft" || state === "changes_requested") {
    return instance.context.submitterUserId === userId;
  }
  if (!isAdmin) return false;
  if (state === "submitted") {
    return instance.context.submitterUserId !== userId;
  }
  if (state === "approved" && instance.definitionId === "three-step-certify") {
    return (
      instance.context.submitterUserId !== userId && instance.context.reviewerUserId !== userId
    );
  }
  return false;
}

function extractComment(event: WorkflowEvent): string | null {
  if (event.type === "request_changes" || event.type === "reject") return event.comment;
  if ("comment" in event && typeof event.comment === "string") return event.comment;
  return null;
}

// Re-export so callers can build typed events without importing graphs/.
export type { WorkflowEvent, WorkflowEventType };
