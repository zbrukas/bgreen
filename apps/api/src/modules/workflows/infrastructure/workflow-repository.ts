import { db, orgScope, schema } from "@bgreen/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { WorkflowRepository } from "../application/workflow-service.js";
import type { WorkflowInstance, WorkflowState } from "../domain/workflow-instance.js";
import {
  type WorkflowContext,
  type WorkflowDefinitionId,
  isWorkflowDefinitionId,
} from "../graphs/index.js";

function rowToInstance(row: typeof schema.workflowInstances.$inferSelect): WorkflowInstance {
  if (!isWorkflowDefinitionId(row.definitionId)) {
    throw new Error(`workflow_instances row has unknown definition_id: ${row.definitionId}`);
  }
  if (row.entityKind !== "record") {
    throw new Error(`workflow_instances row has unsupported entity_kind: ${row.entityKind}`);
  }
  return {
    id: row.id,
    organizationId: row.organizationId,
    entityKind: row.entityKind,
    entityId: row.entityId,
    definitionId: row.definitionId,
    definitionVersion: row.definitionVersion,
    // current_state is text in the DB (v1 graphs are always atomic). The
    // WorkflowState type still allows compound shapes for the engine —
    // a plain string trivially satisfies it.
    currentState: row.currentState satisfies WorkflowState,
    context: row.context as WorkflowContext,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// XState atomic state names are always strings in v1. If a future
// compound-state graph lands, the DB column type needs to grow and this
// guard becomes the place where the boundary fails loud rather than
// silently inserting an object cast to a string.
function atomicState(value: WorkflowState, op: string): string {
  if (typeof value !== "string") {
    throw new Error(
      `workflow_instances ${op}: only atomic (string) states are persistable in v1, got ${typeof value}`,
    );
  }
  return value;
}

export class DrizzleWorkflowRepository implements WorkflowRepository {
  async insert(input: {
    organizationId: string;
    entityKind: "record";
    entityId: string;
    definitionId: WorkflowDefinitionId;
    definitionVersion: number;
    currentState: WorkflowState;
    context: WorkflowContext;
  }): Promise<WorkflowInstance> {
    const [row] = await db
      .insert(schema.workflowInstances)
      .values({
        organizationId: input.organizationId,
        entityKind: input.entityKind,
        entityId: input.entityId,
        definitionId: input.definitionId,
        definitionVersion: input.definitionVersion,
        currentState: atomicState(input.currentState, "insert"),
        context: input.context as unknown as object,
        submitterUserId: input.context.submitterUserId,
      })
      .returning();
    if (!row) throw new Error("insert workflow_instance: unexpected empty returning() result");
    return rowToInstance(row);
  }

  async updateState(input: {
    instanceId: string;
    currentState: WorkflowState;
    context: WorkflowContext;
  }): Promise<WorkflowInstance | null> {
    const [row] = await db
      .update(schema.workflowInstances)
      .set({
        currentState: atomicState(input.currentState, "updateState"),
        context: input.context as unknown as object,
        submitterUserId: input.context.submitterUserId,
        updatedAt: new Date(),
      })
      .where(eq(schema.workflowInstances.id, input.instanceId))
      .returning();
    return row ? rowToInstance(row) : null;
  }

  async findForEntity(
    organizationId: string,
    entityKind: "record",
    entityId: string,
  ): Promise<WorkflowInstance | null> {
    const rows = await db
      .select()
      .from(schema.workflowInstances)
      .where(
        and(
          orgScope(schema.workflowInstances, organizationId),
          eq(schema.workflowInstances.entityKind, entityKind),
          eq(schema.workflowInstances.entityId, entityId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToInstance(row) : null;
  }

  async listForOrganization(organizationId: string): Promise<WorkflowInstance[]> {
    const rows = await db
      .select()
      .from(schema.workflowInstances)
      .where(orgScope(schema.workflowInstances, organizationId));
    return rows.map(rowToInstance);
  }

  async listByState(state: string): Promise<WorkflowInstance[]> {
    const rows = await db
      .select()
      .from(schema.workflowInstances)
      .where(eq(schema.workflowInstances.currentState, state))
      .orderBy(desc(schema.workflowInstances.updatedAt));
    return rows.map(rowToInstance);
  }

  // H3 — org-side inbox. SQL-side filter on (org, submitter, state) so
  // we never load every workflow row only to discard most of them in JS.
  async listPendingForActor(organizationId: string, userId: string): Promise<WorkflowInstance[]> {
    const rows = await db
      .select()
      .from(schema.workflowInstances)
      .where(
        and(
          orgScope(schema.workflowInstances, organizationId),
          eq(schema.workflowInstances.submitterUserId, userId),
          inArray(schema.workflowInstances.currentState, ["draft", "changes_requested"]),
        ),
      )
      .orderBy(desc(schema.workflowInstances.updatedAt));
    return rows.map(rowToInstance);
  }
}
