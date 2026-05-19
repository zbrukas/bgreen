# packages/form-engine — FormSchemaInterpreter

Bounded context: the typed runtime that validates `FormSchema` JSONB blobs and computes derived fields.

## Owns (from V4 onward)
- `FormSchemaInterpreter` — pure function: `(schema, rawValues) => Result<ValidatedRecord, FormError[]>`.
- zod schemas for `FormSchema / RowSchema / FieldSchema / FieldType / FieldProperties`.
- A small, safe expression language for `calculated` fields (no `eval`).

## Does NOT own
- `RecordTemplate` storage (`apps/api/src/modules/form-templates`).
- Form rendering UI (`apps/web`).
