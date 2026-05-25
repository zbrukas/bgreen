// Repository for `recommendation_feedback` rows.
//
// Upsert on (generated_recommendation_id, recommendation_index, user_id):
// switching feedback for one item updates the existing row rather than
// inserting a new one. The unique index in migration 0018 enforces this
// at the DB level — the ON CONFLICT path is the supported case.

import { db, schema } from "@bgreen/db";
import { and, eq, sql } from "drizzle-orm";
import type {
  FeedbackCounts,
  RecommendationFeedback,
  RecommendationFeedbackKind,
} from "../domain/types.js";

export interface RecommendationFeedbackRepository {
  upsert(input: {
    generatedRecommendationId: string;
    recommendationIndex: number;
    userId: string;
    kind: RecommendationFeedbackKind;
  }): Promise<RecommendationFeedback>;

  listForGeneration(generatedRecommendationId: string): Promise<RecommendationFeedback[]>;

  countsByGeneration(generatedRecommendationId: string): Promise<FeedbackCounts>;
}

type Row = typeof schema.recommendationFeedback.$inferSelect;

function rowToDomain(row: Row): RecommendationFeedback {
  return {
    id: row.id,
    generatedRecommendationId: row.generatedRecommendationId,
    recommendationIndex: row.recommendationIndex,
    userId: row.userId,
    kind: row.kind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleRecommendationFeedbackRepository
  implements RecommendationFeedbackRepository
{
  async upsert(input: {
    generatedRecommendationId: string;
    recommendationIndex: number;
    userId: string;
    kind: RecommendationFeedbackKind;
  }): Promise<RecommendationFeedback> {
    const now = new Date();
    const [row] = await db
      .insert(schema.recommendationFeedback)
      .values({
        generatedRecommendationId: input.generatedRecommendationId,
        recommendationIndex: input.recommendationIndex,
        userId: input.userId,
        kind: input.kind,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.recommendationFeedback.generatedRecommendationId,
          schema.recommendationFeedback.recommendationIndex,
          schema.recommendationFeedback.userId,
        ],
        set: {
          kind: input.kind,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("upsert recommendation_feedback: empty returning() result");
    return rowToDomain(row);
  }

  async listForGeneration(generatedRecommendationId: string): Promise<RecommendationFeedback[]> {
    const rows = await db
      .select()
      .from(schema.recommendationFeedback)
      .where(
        eq(schema.recommendationFeedback.generatedRecommendationId, generatedRecommendationId),
      );
    return rows.map(rowToDomain);
  }

  async countsByGeneration(generatedRecommendationId: string): Promise<FeedbackCounts> {
    // Aggregate at the DB rather than pulling rows + counting in JS.
    // The history view calls this once per visible generation row.
    const rows = await db
      .select({
        kind: schema.recommendationFeedback.kind,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.recommendationFeedback)
      .where(
        and(
          eq(schema.recommendationFeedback.generatedRecommendationId, generatedRecommendationId),
        ),
      )
      .groupBy(schema.recommendationFeedback.kind);
    const out: FeedbackCounts = {};
    for (const row of rows) {
      out[row.kind] = row.count;
    }
    return out;
  }
}
