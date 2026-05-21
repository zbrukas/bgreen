import { db, orgScope, schema } from "@bgreen/db";
import { and, desc, eq, sql } from "drizzle-orm";
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
    currentState: row.currentState as WorkflowState,
    context: row.context as WorkflowContext,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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
        currentState: input.currentState as unknown as object,
        context: input.context as unknown as object,
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
        currentState: input.currentState as unknown as object,
        context: input.context as unknown as object,
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
    // current_state is a jsonb scalar (a quoted string for atomic states).
    // Compare against the JSON string so we match `"submitted"`, not `submitted`.
    const rows = await db
      .select()
      .from(schema.workflowInstances)
      .where(sql`${schema.workflowInstances.currentState}::text = ${JSON.stringify(state)}`)
      .orderBy(desc(schema.workflowInstances.updatedAt));
    return rows.map(rowToInstance);
  }
}
