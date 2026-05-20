import { z } from "zod";

// Field identifier: short slug, lowercased letters/digits/underscore. The
// template editor enforces uniqueness within a FormSchema.
export const FieldIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Field id must be a snake_case slug starting with a letter.");
export type FieldId = z.infer<typeof FieldIdSchema>;

const baseField = {
  id: FieldIdSchema,
  label: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  required: z.boolean().optional(),
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

export const SelectFieldSchema = z.object({
  ...baseField,
  kind: z.literal("select"),
  options: z
    .array(
      z.object({
        value: z.string().min(1).max(100),
        label: z.string().min(1).max(200),
      }),
    )
    .min(1),
});
export type SelectField = z.infer<typeof SelectFieldSchema>;

export const FieldSchema = z.discriminatedUnion("kind", [
  TextFieldSchema,
  NumberFieldSchema,
  DateFieldSchema,
  SelectFieldSchema,
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
//   text   → string
//   number → number (after coercion)
//   date   → string YYYY-MM-DD
//   select → string (one of the option values)
export const RecordValuesSchema = z.record(z.string(), z.unknown());
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
