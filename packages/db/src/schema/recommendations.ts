import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { organizations } from "./organizations";
import { users } from "./users";

// V9.1 — one row per "Gerar recomendações" run. The recommendations
// array is stored as JSONB so the rest of the product (history view,
// PDF rendering in V11) reads it without joining a per-item table.
// Per-item feedback joins on (generation_id, recommendation_index).

export const recommendationsStatusEnum = pgEnum("recommendations_status", [
  "pending",
  "running",
  "ready",
  "failed",
  "cancelled",
]);

export const recommendationsCompletenessEnum = pgEnum("recommendations_completeness", [
  "FULL",
  "PARTIAL",
  "INCOMPLETE",
]);

export const recommendationFeedbackKindEnum = pgEnum("recommendation_feedback_kind", [
  "util",
  "ja_implementada",
  "nao_aplicavel",
  "irrelevante",
  "incorreta",
]);

export const generatedRecommendations = pgTable(
  "generated_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    requestedByUserId: uuid("requested_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    status: recommendationsStatusEnum("status").notNull().default("pending"),
    completenessMode: recommendationsCompletenessEnum("completeness_mode").notNull(),
    // Array of {title, description, estimatedImpact, implementationEffort,
    // timeHorizon, rationale}. Null until the AI call returns.
    recommendations: jsonb("recommendations"),
    errorMessage: text("error_message"),
    aiInputTokens: integer("ai_input_tokens"),
    aiOutputTokens: integer("ai_output_tokens"),
    inngestRunId: text("inngest_run_id"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    orgIdx: index("generated_recommendations_org_idx").on(t.organizationId, t.createdAt),
    statusIdx: index("generated_recommendations_status_idx").on(t.status),
  }),
);

export type GeneratedRecommendationRow = typeof generatedRecommendations.$inferSelect;
export type NewGeneratedRecommendationRow = typeof generatedRecommendations.$inferInsert;

export const recommendationFeedback = pgTable(
  "recommendation_feedback",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    generatedRecommendationId: uuid("generated_recommendation_id")
      .notNull()
      .references(() => generatedRecommendations.id, { onDelete: "cascade" }),
    // Index into the JSONB recommendations array. The pair (generation,
    // index) addresses one specific item; the unique below caps per-user
    // feedback at one row per recommendation.
    recommendationIndex: integer("recommendation_index").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: recommendationFeedbackKindEnum("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    perItemUnique: unique("recommendation_feedback_unique").on(
      t.generatedRecommendationId,
      t.recommendationIndex,
      t.userId,
    ),
    genIdx: index("recommendation_feedback_gen_idx").on(
      t.generatedRecommendationId,
      t.kind,
    ),
  }),
);

export type RecommendationFeedbackRow = typeof recommendationFeedback.$inferSelect;
export type NewRecommendationFeedbackRow = typeof recommendationFeedback.$inferInsert;
