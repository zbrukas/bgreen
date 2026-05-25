// Repository for `generated_recommendations` rows.
//
// Drizzle adapter + port. Tenant-scoped on every read except the
// Inngest-entry findAnyById (the function arrives with just a genId
// and resolves org context from the row itself, mirroring the V6
// ies-extraction pattern).

import { db, orgScope, schema } from "@bgreen/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  CompletenessMode,
  GeneratedRecommendation,
  Recommendation,
  RecommendationsStatus,
} from "../domain/types.js";

export interface GeneratedRecommendationRepository {
  insert(input: {
    organizationId: string;
    requestedByUserId: string | null;
    completenessMode: CompletenessMode;
  }): Promise<GeneratedRecommendation>;

  findAnyById(id: string): Promise<GeneratedRecommendation | null>;

  findById(organizationId: string, id: string): Promise<GeneratedRecommendation | null>;

  listForOrganization(organizationId: string): Promise<GeneratedRecommendation[]>;

  update(
    id: string,
    fields: Partial<{
      status: RecommendationsStatus;
      recommendations: Recommendation[] | null;
      errorMessage: string | null;
      aiInputTokens: number | null;
      aiOutputTokens: number | null;
      inngestRunId: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
    }>,
  ): Promise<GeneratedRecommendation | null>;
}

type Row = typeof schema.generatedRecommendations.$inferSelect;

function rowToDomain(row: Row): GeneratedRecommendation {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestedByUserId: row.requestedByUserId,
    status: row.status,
    completenessMode: row.completenessMode,
    recommendations: row.recommendations as Recommendation[] | null,
    errorMessage: row.errorMessage,
    aiInputTokens: row.aiInputTokens,
    aiOutputTokens: row.aiOutputTokens,
    inngestRunId: row.inngestRunId,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleGeneratedRecommendationRepository
  implements GeneratedRecommendationRepository
{
  async insert(input: {
    organizationId: string;
    requestedByUserId: string | null;
    completenessMode: CompletenessMode;
  }): Promise<GeneratedRecommendation> {
    const [row] = await db
      .insert(schema.generatedRecommendations)
      .values({
        organizationId: input.organizationId,
        requestedByUserId: input.requestedByUserId,
        completenessMode: input.completenessMode,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("insert generated_recommendations: empty returning() result");
    return rowToDomain(row);
  }

  async findAnyById(id: string): Promise<GeneratedRecommendation | null> {
    const rows = await db
      .select()
      .from(schema.generatedRecommendations)
      .where(eq(schema.generatedRecommendations.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToDomain(row) : null;
  }

  async findById(organizationId: string, id: string): Promise<GeneratedRecommendation | null> {
    const rows = await db
      .select()
      .from(schema.generatedRecommendations)
      .where(
        and(
          orgScope(schema.generatedRecommendations, organizationId),
          eq(schema.generatedRecommendations.id, id),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToDomain(row) : null;
  }

  async listForOrganization(organizationId: string): Promise<GeneratedRecommendation[]> {
    const rows = await db
      .select()
      .from(schema.generatedRecommendations)
      .where(orgScope(schema.generatedRecommendations, organizationId))
      // Most-recent first — history view reads top-to-bottom.
      .orderBy(desc(schema.generatedRecommendations.createdAt));
    return rows.map(rowToDomain);
  }

  async update(
    id: string,
    fields: Partial<{
      status: RecommendationsStatus;
      recommendations: Recommendation[] | null;
      errorMessage: string | null;
      aiInputTokens: number | null;
      aiOutputTokens: number | null;
      inngestRunId: string | null;
      startedAt: Date | null;
      completedAt: Date | null;
    }>,
  ): Promise<GeneratedRecommendation | null> {
    const set: Record<string, unknown> = {};
    if (fields.status !== undefined) set.status = fields.status;
    if (fields.recommendations !== undefined) set.recommendations = fields.recommendations;
    if (fields.errorMessage !== undefined) set.errorMessage = fields.errorMessage;
    if (fields.aiInputTokens !== undefined) set.aiInputTokens = fields.aiInputTokens;
    if (fields.aiOutputTokens !== undefined) set.aiOutputTokens = fields.aiOutputTokens;
    if (fields.inngestRunId !== undefined) set.inngestRunId = fields.inngestRunId;
    if (fields.startedAt !== undefined) set.startedAt = fields.startedAt;
    if (fields.completedAt !== undefined) set.completedAt = fields.completedAt;
    if (Object.keys(set).length === 0) return this.findAnyById(id);
    await db
      .update(schema.generatedRecommendations)
      .set(set)
      .where(eq(schema.generatedRecommendations.id, id));
    return this.findAnyById(id);
  }
}
