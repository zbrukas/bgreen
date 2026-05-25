import { z } from "zod";

// V12.1 — Customer Success Telemetry shared types. Single zod source
// per CLAUDE G-5: drives request validation, RPC inference, the
// CsHealthCalculator signal shape (V12.2), and the snapshot row shape.

export const RequirementRecurrenceSchema = z.enum([
  "annual",
  "quarterly",
  "monthly",
  "once",
]);
export type RequirementRecurrence = z.infer<typeof RequirementRecurrenceSchema>;

export const OrganizationRequiredTemplateSchema = z.object({
  organizationId: z.string().uuid(),
  templateId: z.string().uuid(),
  recurrence: RequirementRecurrenceSchema,
  firstDueAt: z.string().datetime({ offset: true }),
  assignedByUserId: z.string().uuid().nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type OrganizationRequiredTemplate = z.infer<typeof OrganizationRequiredTemplateSchema>;

export const AssignRequiredTemplateInputSchema = z.object({
  templateId: z.string().uuid(),
  recurrence: RequirementRecurrenceSchema,
  // ISO 8601. Marks the first expected submission window — coverage in
  // V12.2 computes `current_period_start(recurrence, firstDueAt)` to
  // figure out whether the current period has a matching submission.
  firstDueAt: z.string().datetime({ offset: true }),
});
export type AssignRequiredTemplateInput = z.infer<typeof AssignRequiredTemplateInputSchema>;

// V12.2 — health row + snapshot shape. Both share the same record
// vocabulary so the snapshot's jsonb column can be parsed into the
// live row type. Score numeric fields arrive as JS number from the
// API boundary (Drizzle numeric → string → number).
export const CsHealthTierSchema = z.enum(["green", "yellow", "red"]);
export type CsHealthTier = z.infer<typeof CsHealthTierSchema>;

export const CsHealthDimensionSchema = z.enum([
  "coverage",
  "engagement",
  "login",
  "activation",
  "score",
]);
export type CsHealthDimension = z.infer<typeof CsHealthDimensionSchema>;

export const CsHealthBreakdownSchema = z.object({
  dimension: CsHealthDimensionSchema,
  rawScore: z.number(),
  weight: z.number(),
  contribution: z.number(),
});
export type CsHealthBreakdown = z.infer<typeof CsHealthBreakdownSchema>;

export const CsHealthRowSchema = z.object({
  organizationId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  daysSinceCreated: z.number().int().nonnegative(),
  firstRecordSubmittedAt: z.string().datetime({ offset: true }).nullable(),
  daysToFirstRecord: z.number().int().nullable(),
  activatedIn30d: z.boolean(),
  recordsCurrentQuarter: z.number().int().nonnegative(),
  recordsPreviousQuarter: z.number().int().nonnegative(),
  engagementTrend: z.enum(["up", "flat", "down"]),
  requiredTemplatesCount: z.number().int().nonnegative(),
  requiredTemplatesWithCurrentPeriodData: z.number().int().nonnegative(),
  coveragePercent: z.number().nullable(),
  latestScoreYoyDelta: z.number().nullable(),
  lastLoginAt: z.string().datetime({ offset: true }).nullable(),
  daysSinceLastLogin: z.number().int().nullable(),
  wauCount: z.number().int().nonnegative(),
  mauCount: z.number().int().nonnegative(),
  stagnantWorkflowsCount: z.number().int().nonnegative(),
  oldestStagnantWorkflowDays: z.number().int().nullable(),
  stagnantWorkflowsByDefinition: z.record(z.string(), z.number().int().nonnegative()),
  healthScore: z.number().int().min(0).max(100),
  healthTier: CsHealthTierSchema,
  computedAt: z.string().datetime({ offset: true }),
});
export type CsHealthRow = z.infer<typeof CsHealthRowSchema>;
