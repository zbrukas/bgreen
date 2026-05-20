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

const baseField = {
  id: FieldIdSchema,
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
  showIf: z.array(ShowIfPredicateSchema).max(5).optional(),
  sourceMapping: SourceMappingSchema.optional(),
};

export const TextFieldSchema = z.object({
  ...baseField,
  kind: z.literal("text"),
  maxLength: z.number().int().positive().max(10_000).optional(),
});
export type TextField = z.infer<typeof TextFieldSchema>;

export const NumberFieldSchema = z.object({
  ...baseField,
  kind: z.literal("number"),
  unit: z.string().max(20).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
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

const OptionSchema = z.object({
  value: z.string().min(1).max(100),
  label: z.string().min(1).max(200),
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

export const RepeatingFieldSchema = z.object({
  ...baseField,
  kind: z.literal("repeating"),
  // Singular/plural noun used in the UI (e.g., "Linha", "Veículo").
  rowLabel: z.string().min(1).max(80),
  minRows: z.number().int().min(0).max(100).optional(),
  maxRows: z.number().int().min(1).max(100).optional(),
  fields: z.array(LeafFieldSchema).min(1),
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

export const FormSchemaSchema = z.object({
  version: z.literal(1),
  rows: z.array(FormRowSchema).min(1),
});
export type FormSchema = z.infer<typeof FormSchemaSchema>;

export const RecordTemplateStatusSchema = z.enum(["draft", "published", "archived"]);
export type RecordTemplateStatus = z.infer<typeof RecordTemplateStatusSchema>;

export const RecordTemplateSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullable(),
  formSchema: FormSchemaSchema,
  status: RecordTemplateStatusSchema,
  createdByUserId: z.string().uuid(),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type RecordTemplate = z.infer<typeof RecordTemplateSchema>;

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
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
});
export type Record = z.infer<typeof RecordSchema>;
