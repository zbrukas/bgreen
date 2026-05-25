// Repository for `report_instances` rows. Mirrors the V9
// recommendations + V10 framework-coverage repository patterns:
// tenant-scoped reads via `orgScope`, an Inngest-friendly
// findAnyById (no tenant filter — the function arrives with just an
// id and resolves org context from the row itself).

import { db, orgScope, schema } from "@bgreen/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  ReportCommentary,
  ReportInstance,
  ReportInstanceStatus,
  ReportTemplateId,
} from "../domain/types.js";
import { isReportTemplateId } from "../domain/types.js";

export interface ReportInstanceRepository {
  insert(input: {
    organizationId: string;
    requestedByUserId: string | null;
    templateId: ReportTemplateId;
    periodStart: string;
    periodEnd: string;
    inputDataHash: string;
  }): Promise<ReportInstance>;

  findAnyById(id: string): Promise<ReportInstance | null>;

  findById(organizationId: string, id: string): Promise<ReportInstance | null>;

  listForOrganization(organizationId: string): Promise<ReportInstance[]>;

  update(
    id: string,
    fields: Partial<{
      status: ReportInstanceStatus;
      s3Key: string | null;
      commentary: ReportCommentary | null;
      aiInputTokens: number | null;
      aiOutputTokens: number | null;
      inngestRunId: string | null;
      errorMessage: string | null;
      startedAt: Date | null;
      generatedAt: Date | null;
    }>,
  ): Promise<ReportInstance | null>;
}

type Row = typeof schema.reportInstances.$inferSelect;

function rowToDomain(row: Row): ReportInstance {
  // The DB column is free text so future templates can ship without a
  // migration; coerce defensively at the boundary. Unknown ids fall
  // through to "custom" so the row stays renderable in the UI list.
  const templateId: ReportTemplateId = isReportTemplateId(row.templateId)
    ? row.templateId
    : "custom";
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestedByUserId: row.requestedByUserId,
    templateId,
    periodStart: row.periodStart,
    periodEnd: row.periodEnd,
    status: row.status,
    s3Key: row.s3Key,
    inputDataHash: row.inputDataHash,
    commentary: row.commentaryJson as ReportCommentary | null,
    aiInputTokens: row.aiInputTokens,
    aiOutputTokens: row.aiOutputTokens,
    inngestRunId: row.inngestRunId,
    errorMessage: row.errorMessage,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    generatedAt: row.generatedAt ? row.generatedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleReportInstanceRepository implements ReportInstanceRepository {
  async insert(input: {
    organizationId: string;
    requestedByUserId: string | null;
    templateId: ReportTemplateId;
    periodStart: string;
    periodEnd: string;
    inputDataHash: string;
  }): Promise<ReportInstance> {
    const [row] = await db
      .insert(schema.reportInstances)
      .values({
        organizationId: input.organizationId,
        requestedByUserId: input.requestedByUserId,
        templateId: input.templateId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        inputDataHash: input.inputDataHash,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("insert report_instances: empty returning()");
    return rowToDomain(row);
  }

  async findAnyById(id: string): Promise<ReportInstance | null> {
    const rows = await db
      .select()
      .from(schema.reportInstances)
      .where(eq(schema.reportInstances.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToDomain(row) : null;
  }

  async findById(organizationId: string, id: string): Promise<ReportInstance | null> {
    const rows = await db
      .select()
      .from(schema.reportInstances)
      .where(
        and(
          orgScope(schema.reportInstances, organizationId),
          eq(schema.reportInstances.id, id),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToDomain(row) : null;
  }

  async listForOrganization(organizationId: string): Promise<ReportInstance[]> {
    const rows = await db
      .select()
      .from(schema.reportInstances)
      .where(orgScope(schema.reportInstances, organizationId))
      .orderBy(desc(schema.reportInstances.createdAt));
    return rows.map(rowToDomain);
  }

  async update(
    id: string,
    fields: Partial<{
      status: ReportInstanceStatus;
      s3Key: string | null;
      commentary: ReportCommentary | null;
      aiInputTokens: number | null;
      aiOutputTokens: number | null;
      inngestRunId: string | null;
      errorMessage: string | null;
      startedAt: Date | null;
      generatedAt: Date | null;
    }>,
  ): Promise<ReportInstance | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (fields.status !== undefined) set.status = fields.status;
    if (fields.s3Key !== undefined) set.s3Key = fields.s3Key;
    if (fields.commentary !== undefined) set.commentaryJson = fields.commentary;
    if (fields.aiInputTokens !== undefined) set.aiInputTokens = fields.aiInputTokens;
    if (fields.aiOutputTokens !== undefined) set.aiOutputTokens = fields.aiOutputTokens;
    if (fields.inngestRunId !== undefined) set.inngestRunId = fields.inngestRunId;
    if (fields.errorMessage !== undefined) set.errorMessage = fields.errorMessage;
    if (fields.startedAt !== undefined) set.startedAt = fields.startedAt;
    if (fields.generatedAt !== undefined) set.generatedAt = fields.generatedAt;
    await db
      .update(schema.reportInstances)
      .set(set)
      .where(eq(schema.reportInstances.id, id));
    return this.findAnyById(id);
  }
}
