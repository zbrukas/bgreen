import { z } from "zod";

// Field identifier: short slug, lowercased letters/digits/underscore. The
// template editor enforces uniqueness within a FormSchema.
export const FieldIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Field id must be a snake_case slug starting with a letter.");
export type FieldId = z.infer<typeof FieldIdSchema>;

// Show-if predicate: hide the field unless every predicate matches. The
// referenced fieldId must live in the same containment scope (top-level
// fields can only reference top-level fields; repeating sub-row fields can
// only reference siblings in the same sub-row).
export const ShowIfPredicateSchema = z.object({
  fieldId: FieldIdSchema,
  equals: z.string().max(200),
});
export type ShowIfPredicate = z.infer<typeof ShowIfPredicateSchema>;

// Cross-template prefill rule: when a new draft is created, this field
// is seeded with the value of `sourceFieldId` from the latest submitted
// record of `sourceTemplateId` (same org). v1 supports only one strategy.
export const SourceMappingSchema = z.object({
  sourceTemplateId: z.string().uuid(),
  sourceFieldId: FieldIdSchema,
  strategy: z.literal("latest_submitted"),
});
export type SourceMapping = z.infer<typeof SourceMappingSchema>;

// V8.1 — optional per-field weight applied as a multiplier on the field's
// raw score. Default 1. A weight of 0 effectively excludes the field from
// the total without removing the per-field contribution from the breakdown.
const baseField = {
  id: FieldIdSchema,
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
  showIf: z.array(ShowIfPredicateSchema).max(5).optional(),
  sourceMapping: SourceMappingSchema.optional(),
  // Multiplier on the field's raw score. Range chosen wide enough for
  // common cases (0.1× to 10×) but bounded to catch admin typos.
  weight: z.number().min(0).max(100).optional(),
};

export const TextFieldSchema = z.object({
  ...baseField,
  kind: z.literal("text"),
  maxLength: z.number().int().positive().max(10_000).optional(),
});
export type TextField = z.infer<typeof TextFieldSchema>;

// V8.1 — two scoring strategies for number fields:
//   - linear:    score = value × per (e.g., per=0.5 with value=100 → 50)
//   - thresholds: first-match-wins on a sorted list. `upTo` is inclusive.
//                 Useful for "0–10t = 10pts, 10–50t = 5pts, > 50t = 0pts".
export const NumberLinearScoringSchema = z.object({
  kind: z.literal("linear"),
  per: z.number(),
});

export const NumberThresholdScoringSchema = z.object({
  kind: z.literal("thresholds"),
  thresholds: z
    .array(
      z.object({
        upTo: z.number(),
        score: z.number(),
      }),
    )
    .min(1),
});

export const NumberScoringSchema = z.discriminatedUnion("kind", [
  NumberLinearScoringSchema,
  NumberThresholdScoringSchema,
]);
export type NumberScoring = z.infer<typeof NumberScoringSchema>;

export const NumberFieldSchema = z.object({
  ...baseField,
  kind: z.literal("number"),
  unit: z.string().max(20).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  scoring: NumberScoringSchema.optional(),
});
export type NumberField = z.infer<typeof NumberFieldSchema>;

export const DateFieldSchema = z.object({
  ...baseField,
  kind: z.literal("date"),
  // YYYY-MM-DD lower/upper bound; field values are also YYYY-MM-DD strings.
  min: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  max: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});
export type DateField = z.infer<typeof DateFieldSchema>;

// V8.1 — option-level optional score. select picks the chosen option's
// score; multi_select sums over selected options.
const OptionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
  score: z.number().optional(),
});

export const SelectFieldSchema = z.object({
  ...baseField,
  kind: z.literal("select"),
  options: z.array(OptionSchema).min(1),
});
export type SelectField = z.infer<typeof SelectFieldSchema>;

export const MultiSelectFieldSchema = z.object({
  ...baseField,
  kind: z.literal("multi_select"),
  options: z.array(OptionSchema).min(1),
  // Selection-count bounds. `required` controls "must select at least one";
  // `minSelected` lets the admin demand more than one.
  minSelected: z.number().int().min(1).max(50).optional(),
  maxSelected: z.number().int().min(1).max(50).optional(),
});
export type MultiSelectField = z.infer<typeof MultiSelectFieldSchema>;

// Calculated field — read-only, value is derived from other fields in
// the same scope via the expression language in @bgreen/form-engine.
// The server evaluates the expression during validation; user-provided
// values for calculated fields are ignored.
export const CalculatedFieldSchema = z.object({
  ...baseField,
  kind: z.literal("calculated"),
  // Expression source; parsed and evaluated by the form-engine.
  expression: z.string().min(1).max(500),
  // Display unit shown after the computed number (e.g., "kg CO₂e").
  unit: z.string().max(20).optional(),
});
export type CalculatedField = z.infer<typeof CalculatedFieldSchema>;

// Leaf field union — everything that can live anywhere, including inside
// a `repeating` sub-row. Excludes `repeating` itself so nesting is bounded
// to one level (v1 constraint).
export const LeafFieldSchema = z.discriminatedUnion("kind", [
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  SelectFieldSchema,
  MultiSelectFieldSchema,
  CalculatedFieldSchema,
]);
export type LeafField = z.infer<typeof LeafFieldSchema>;
export type LeafFieldKind = LeafField["kind"];

// V8.1 — how a repeating group rolls its sub-row scores up to one
// field-level raw score. Default sum matches the most common "total
// ESG impact" framing. avg useful for "average satisfaction"; min/max
// for "worst/best sub-row dominates".
export const RepeatingAggregateSchema = z.enum(["sum", "avg", "min", "max"]);
export type RepeatingAggregate = z.infer<typeof RepeatingAggregateSchema>;

export const RepeatingFieldSchema = z.object({
  ...baseField,
  kind: z.literal("repeating"),
  // Singular/plural noun used in the UI (e.g., "Linha", "Veículo").
  rowLabel: z.string().min(1).max(80),
  minRows: z.number().int().min(0).max(100).optional(),
  maxRows: z.number().int().min(1).max(100).optional(),
  fields: z.array(LeafFieldSchema).min(1),
  // V8.1 — aggregation strategy over per-sub-row scores. Default sum.
  aggregate: RepeatingAggregateSchema.optional(),
});
export type RepeatingField = z.infer<typeof RepeatingFieldSchema>;

export const FieldSchema = z.discriminatedUnion("kind", [
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  SelectFieldSchema,
  MultiSelectFieldSchema,
  CalculatedFieldSchema,
  RepeatingFieldSchema,
]);
export type Field = z.infer<typeof FieldSchema>;
export type FieldKind = Field["kind"];

export const FormRowSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().max(200).optional(),
  fields: z.array(FieldSchema).min(1),
});
export type FormRow = z.infer<typeof FormRowSchema>;

// V8.1 — template-level tier buckets + max score. Buckets are minPct
// thresholds (e.g., 0 "C", 50 "B", 80 "A"); the engine picks the highest
// matching bucket. maxScore is the denominator for percent computation —
// admins set it explicitly so renaming/removing fields doesn't silently
// change the tier breakpoints.
export const ScoringBucketSchema = z.object({
  minPct: z.number().min(0).max(100),
  label: z.string().min(1).max(40),
});

export const FormSchemaScoringSchema = z.object({
  maxScore: z.number().positive(),
  buckets: z.array(ScoringBucketSchema).min(1),
});
export type FormSchemaScoring = z.infer<typeof FormSchemaScoringSchema>;

export const FormSchemaSchema = z.object({
  version: z.literal(1),
  rows: z.array(FormRowSchema).min(1),
  // V8.1 — optional. Templates without `scoring` skip score computation;
  // existing v4 templates remain valid.
  scoring: FormSchemaScoringSchema.optional(),
});
export type FormSchema = z.infer<typeof FormSchemaSchema>;

export const RecordTemplateStatusSchema = z.enum(["draft", "published", "archived"]);
export type RecordTemplateStatus = z.infer<typeof RecordTemplateStatusSchema>;

// Workflow graph that records submitted under this template will follow.
// V5.2 introduces this; v4 templates default to "two-step-review" on
// migration so existing review-queue UX is preserved.
export const WorkflowDefinitionIdSchema = z.enum([
  "single-step-submit",
  "two-step-review",
  "three-step-certify",
]);
export type WorkflowDefinitionId = z.infer<typeof WorkflowDefinitionIdSchema>;

export const RecordTemplateSchema = z.object({
  id: z.string().uuid(),
  // V5.4: templates are central-services owned. No organizationId.
  name: z.string().min(1),
  description: z.string().nullable(),
  formSchema: FormSchemaSchema,
  status: RecordTemplateStatusSchema,
  workflowDefinitionId: WorkflowDefinitionIdSchema,
  // V5.5: topic tag + composition. composedSubTemplateIds is ordered (by
  // template_compositions.position asc) and may be empty for leaf templates
  // and sub-templates themselves.
  topicTagId: z.string().uuid().nullable(),
  isSubTemplate: z.boolean(),
  composedSubTemplateIds: z.array(z.string().uuid()).default([]),
  createdByUserId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type RecordTemplate = z.infer<typeof RecordTemplateSchema>;

// V12.x list-query options for the /record-templates index endpoint.
// `q` is a case-insensitive substring search over name + description.
// `sub` is tri-state: "yes" → only sub-templates, "no" → only main
// templates, absent → both. Status is single-value (no multi-select yet).
export const RecordTemplateListSortSchema = z.enum([
  "name",
  "status",
  "updatedAt",
  "createdAt",
]);
export type RecordTemplateListSort = z.infer<typeof RecordTemplateListSortSchema>;

export const RecordTemplateListOptionsSchema = z.object({
  q: z.string().trim().min(1).max(200).optional(),
  sort: RecordTemplateListSortSchema.optional(),
  dir: z.enum(["asc", "desc"]).optional(),
  status: RecordTemplateStatusSchema.optional(),
  sub: z.enum(["yes", "no"]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export type RecordTemplateListOptions = z.infer<typeof RecordTemplateListOptionsSchema>;

export const RecordStatusSchema = z.enum([
  "draft",
  "submitted",
  "approved",
  "changes_requested",
  "rejected",
]);
export type RecordStatus = z.infer<typeof RecordStatusSchema>;

// Stored as fieldId → value. Concrete value types depend on field kind:
//   text         → string
//   number       → number (after coercion)
//   date         → string YYYY-MM-DD
//   select       → string (one of the option values)
//   multi_select → string[] (subset of option values, deduplicated)
//   repeating    → Array<RecordValues>, one entry per sub-row
export const RecordValuesSchema: z.ZodType<{ [key: string]: unknown }> = z.record(
  z.string(),
  z.unknown(),
);
export type RecordValues = z.infer<typeof RecordValuesSchema>;

// V8.2 — per-record score snapshot. ScoreBreakdownEntrySchema mirrors
// @bgreen/scoring's ScoreContribution. Defined locally so @bgreen/types
// stays a leaf package (no dependency on scoring).
export const ScoreBreakdownEntrySchema = z.object({
  fieldId: FieldIdSchema,
  raw: z.number(),
  weight: z.number(),
  weighted: z.number(),
});
export type ScoreBreakdownEntry = z.infer<typeof ScoreBreakdownEntrySchema>;

export const RecordSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  templateId: z.string().uuid(),
  status: RecordStatusSchema,
  values: RecordValuesSchema,
  reviewComment: z.string().nullable(),
  submittedAt: z.string().datetime({ offset: true }).nullable(),
  submittedByUserId: z.string().uuid().nullable(),
  reviewedAt: z.string().datetime({ offset: true }).nullable(),
  reviewedByUserId: z.string().uuid().nullable(),
  // V8.2 score snapshot. Null when the template has no scoring metadata,
  // or for drafts. Populated at submit / re-submit time.
  score: z.number().nullable(),
  scorePercent: z.number().nullable(),
  scoreTier: z.string().nullable(),
  scoreBreakdown: z.array(ScoreBreakdownEntrySchema).nullable(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Record = z.infer<typeof RecordSchema>;

// Slim projection used by list endpoints: omits the per-record JSONB
// columns (`values`, `scoreBreakdown`) that list consumers don't read.
// Saves both the DB→API JSONB fetch and the API→web wire payload.
// Use `Record` (wide) for detail reads, cross-template prefill, AI
// tools, and any caller that actually inspects per-field values.
export const RecordSummarySchema = RecordSchema.omit({
  values: true,
  scoreBreakdown: true,
});
export type RecordSummary = z.infer<typeof RecordSummarySchema>;
