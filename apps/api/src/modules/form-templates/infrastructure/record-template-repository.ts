import { db, schema } from "@bgreen/db";
import type {
  FormSchema,
  RecordTemplate,
  RecordTemplateStatus,
  WorkflowDefinitionId,
} from "@bgreen/types";
import { eq, inArray } from "drizzle-orm";
import type {
  CreateRecordTemplateInput,
  RecordTemplateRepository,
  UpdateRecordTemplateInput,
} from "../application/record-template-service.js";

// V5.4: templates are central-services-owned, no longer scoped to an
// organisation. Queries drop the orgScope helper.

function rowToTemplate(
  row: typeof schema.recordTemplates.$inferSelect,
  composedSubTemplateIds: string[] = [],
): RecordTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    formSchema: row.formSchema as FormSchema,
    status: row.status,
    workflowDefinitionId: row.workflowDefinitionId as WorkflowDefinitionId,
    topicTagId: row.topicTagId,
    isSubTemplate: row.isSubTemplate,
    composedSubTemplateIds,
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
        name: input.name,
        description: input.description,
        formSchema: input.formSchema,
        createdByUserId: input.createdByUserId,
        ...(input.workflowDefinitionId ? { workflowDefinitionId: input.workflowDefinitionId } : {}),
        ...(input.topicTagId ? { topicTagId: input.topicTagId } : {}),
        ...(input.isSubTemplate !== undefined ? { isSubTemplate: input.isSubTemplate } : {}),
      })
      .returning();
    if (!row) {
      throw new Error("create record_template: unexpected empty returning() result");
    }
    return rowToTemplate(row);
  }

  async findById(id: string): Promise<RecordTemplate | null> {
    const rows = await db
      .select()
      .from(schema.recordTemplates)
      .where(eq(schema.recordTemplates.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToTemplate(row) : null;
  }

  async findByIds(ids: string[]): Promise<RecordTemplate[]> {
    if (ids.length === 0) return [];
    const rows = await db
      .select()
      .from(schema.recordTemplates)
      .where(inArray(schema.recordTemplates.id, ids));
    return rows.map((row) => rowToTemplate(row));
  }

  async listAll(): Promise<RecordTemplate[]> {
    const rows = await db.select().from(schema.recordTemplates);
    return rows.map((row) => rowToTemplate(row));
  }

  async update(id: string, patch: UpdateRecordTemplateInput): Promise<RecordTemplate | null> {
    const [row] = await db
      .update(schema.recordTemplates)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined ? { description: patch.description } : {}),
        ...(patch.formSchema !== undefined ? { formSchema: patch.formSchema } : {}),
        ...(patch.topicTagId !== undefined ? { topicTagId: patch.topicTagId } : {}),
        ...(patch.isSubTemplate !== undefined ? { isSubTemplate: patch.isSubTemplate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.recordTemplates.id, id))
      .returning();
    return row ? rowToTemplate(row) : null;
  }

  async setStatus(id: string, status: RecordTemplateStatus): Promise<RecordTemplate | null> {
    const [row] = await db
      .update(schema.recordTemplates)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.recordTemplates.id, id))
      .returning();
    return row ? rowToTemplate(row) : null;
  }
}
