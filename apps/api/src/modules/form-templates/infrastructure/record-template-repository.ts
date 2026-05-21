import { db, orgScope, schema } from "@bgreen/db";
import type {
  FormSchema,
  RecordTemplate,
  RecordTemplateStatus,
  WorkflowDefinitionId,
} from "@bgreen/types";
import { and, eq } from "drizzle-orm";
import type {
  CreateRecordTemplateInput,
  RecordTemplateRepository,
  UpdateRecordTemplateInput,
} from "../application/record-template-service.js";

function rowToTemplate(row: typeof schema.recordTemplates.$inferSelect): RecordTemplate {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    description: row.description,
    formSchema: row.formSchema as FormSchema,
    status: row.status,
    workflowDefinitionId: row.workflowDefinitionId as WorkflowDefinitionId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleRecordTemplateRepository implements RecordTemplateRepository {
  async create(input: CreateRecordTemplateInput): Promise<RecordTemplate> {
    const [row] = await db
      .insert(schema.recordTemplates)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        formSchema: input.formSchema,
        createdByUserId: input.createdByUserId,
        ...(input.workflowDefinitionId ? { workflowDefinitionId: input.workflowDefinitionId } : {}),
      })
      .returning();
    if (!row) {
      throw new Error("create record_template: unexpected empty returning() result");
    }
    return rowToTemplate(row);
  }

  async findById(organizationId: string, id: string): Promise<RecordTemplate | null> {
    const rows = await db
      .select()
      .from(schema.recordTemplates)
      .where(
        and(orgScope(schema.recordTemplates, organizationId), eq(schema.recordTemplates.id, id)),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToTemplate(row) : null;
  }

  async listForOrganization(organizationId: string): Promise<RecordTemplate[]> {
    const rows = await db
      .select()
      .from(schema.recordTemplates)
      .where(orgScope(schema.recordTemplates, organizationId));
    return rows.map(rowToTemplate);
  }

  async update(
    organizationId: string,
    id: string,
    patch: UpdateRecordTemplateInput,
  ): Promise<RecordTemplate | null> {
    const [row] = await db
      .update(schema.recordTemplates)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.formSchema !== undefined ? { formSchema: patch.formSchema } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(orgScope(schema.recordTemplates, organizationId), eq(schema.recordTemplates.id, id)),
      )
      .returning();
    return row ? rowToTemplate(row) : null;
  }

  async setStatus(
    organizationId: string,
    id: string,
    status: RecordTemplateStatus,
  ): Promise<RecordTemplate | null> {
    const [row] = await db
      .update(schema.recordTemplates)
      .set({ status, updatedAt: new Date() })
      .where(
        and(orgScope(schema.recordTemplates, organizationId), eq(schema.recordTemplates.id, id)),
      )
      .returning();
    return row ? rowToTemplate(row) : null;
  }
}
