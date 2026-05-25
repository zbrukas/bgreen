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
  // V5.4: cross-org listing for the CS reviewer inbox.
  listByState(state: string): Promise<WorkflowInstance[]>;
  // V12 perf: SQL-side filter for the org-side inbox (state ∈ pending
  // set AND submitterUserId = user). See H3 in plans/db-performance.
  listPendingForActor(organizationId: string, userId: string): Promise<WorkflowInstance[]>;
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

  // CS reviewer inbox: every workflow instance in the "submitted" state,
  // across all orgs. Returned ordered by updated_at descending so the
  // freshest submissions land at the top.
  listAllSubmitted(): Promise<WorkflowInstance[]> {
    return this.repo.listByState("submitted");
  }

  // V5.4: org-side inbox is owner-only — drafts to fill in and records
  // returned with changes_requested. Review/certify lives in apps/cs.
  listPendingForActor(organizationId: string, userId: string): Promise<WorkflowInstance[]> {
    return this.repo.listPendingForActor(organizationId, userId);
  }
}

function extractComment(event: WorkflowEvent): string | null {
  if (event.type === "request_changes" || event.type === "reject") return event.comment;
  if ("comment" in event && typeof event.comment === "string") return event.comment;
  return null;
}

// Re-export so callers can build typed events without importing graphs/.
export type { WorkflowEvent, WorkflowEventType };
