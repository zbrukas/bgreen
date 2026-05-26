import { db, schema } from "@bgreen/db";
import type {
  FormSchema,
  RecordTemplate,
  RecordTemplateListOptions,
  RecordTemplateStatus,
  WorkflowDefinitionId,
} from "@bgreen/types";
import { type SQL, and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";

// Default page size for list endpoints when the caller doesn't pin one.
// Kept in sync with apps/cs's TablePagination.DEFAULT_PAGE_SIZE.
const DEFAULT_PAGE_SIZE = 10;
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

  async listAll(
    options: RecordTemplateListOptions = {},
  ): Promise<{ items: RecordTemplate[]; total: number }> {
    const conditions: SQL[] = [];
    if (options.q) {
      const like = `%${options.q}%`;
      const search = or(
        ilike(schema.recordTemplates.name, like),
        ilike(schema.recordTemplates.description, like),
      );
      if (search) conditions.push(search);
    }
    if (options.status) conditions.push(eq(schema.recordTemplates.status, options.status));
    if (options.sub === "yes") conditions.push(eq(schema.recordTemplates.isSubTemplate, true));
    if (options.sub === "no") conditions.push(eq(schema.recordTemplates.isSubTemplate, false));

    const column = (() => {
      switch (options.sort) {
        case "name":
          return schema.recordTemplates.name;
        case "status":
          return schema.recordTemplates.status;
        case "createdAt":
          return schema.recordTemplates.createdAt;
        default:
          return schema.recordTemplates.updatedAt;
      }
    })();
    const order = options.dir === "asc" ? asc(column) : desc(column);

    const where = conditions.length === 0 ? undefined : and(...conditions);
    // Pagination is opt-in: if neither page nor pageSize is provided we
    // return every matching row (picker-style consumers). Sending either
    // param activates LIMIT/OFFSET, with the other defaulting.
    const paginate = options.page !== undefined || options.pageSize !== undefined;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = options.page ?? 1;
    const offset = (page - 1) * pageSize;

    const dataQuery = db
      .select()
      .from(schema.recordTemplates)
      .where(where)
      .orderBy(order);
    const [rows, totalRow] = await Promise.all([
      paginate ? dataQuery.limit(pageSize).offset(offset) : dataQuery,
      db
        .select({ value: count() })
        .from(schema.recordTemplates)
        .where(where),
    ]);
    const items = rows.map((row) => rowToTemplate(row));
    return { items, total: totalRow[0]?.value ?? 0 };
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
