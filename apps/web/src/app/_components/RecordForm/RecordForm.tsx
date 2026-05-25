"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import type { ComposedSchema } from "@bgreen/form-engine";
import { validateComposedFormValues, validateFormValues } from "@bgreen/form-engine";
import type { LeafField, RecordTemplate } from "@bgreen/types";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { submitRecordAction } from "../../actions";
import { FieldInput } from "./FieldInput";
import { ReadOnlyView } from "./ReadOnlyView";
import {
  type FormValues,
  type RowKeysByField,
  buildInitialRowKeys,
  buildInitialValues,
  newSubRow,
} from "./record-form-helpers";
import {
  type KeyedError,
  type SubTemplateSection,
  attachKeys,
  splitComposedInitial,
  translateError,
} from "./utils";

export type { SubTemplateSection } from "./utils";

interface RecordFormProps {
  template: RecordTemplate;
  recordId: string | null;
  initialValues?: FormValues;
  readOnly?: boolean;
  initialStatus?: "draft" | "submitted" | "approved" | "changes_requested" | "rejected";
  // V5.5: ordered list of sub-templates this main template composes.
  // Pass an empty array (or omit) for non-composed templates.
  subTemplates?: SubTemplateSection[];
}

export function RecordForm({
  template,
  recordId,
  initialValues,
  readOnly = false,
  initialStatus,
  subTemplates = [],
}: RecordFormProps) {
  const router = useRouter();

  // The useState initialisers run once on mount, so it's safe to do the
  // splitting + per-sub build there without memoization. Stored shape:
  // { ...mainFields, subs?: { [subId]: {...subFields} } }
  const [values, setValues] = useState<FormValues>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    return buildInitialValues(template.formSchema, split.main);
  });
  const [rowKeys, setRowKeys] = useState<RowKeysByField>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    return buildInitialRowKeys(template.formSchema, split.main);
  });
  const [subValues, setSubValues] = useState<Record<string, FormValues>>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    const out: Record<string, FormValues> = {};
    for (const sub of subTemplates) {
      out[sub.id] = buildInitialValues(sub.formSchema, split.subs[sub.id]);
    }
    return out;
  });
  const [subRowKeys, setSubRowKeys] = useState<Record<string, RowKeysByField>>(() => {
    const split = splitComposedInitial(initialValues, subTemplates);
    const out: Record<string, RowKeysByField> = {};
    for (const sub of subTemplates) {
      out[sub.id] = buildInitialRowKeys(sub.formSchema, split.subs[sub.id]);
    }
    return out;
  });

  const [serverError, setServerError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<KeyedError[]>([]);
  const [isPending, startTransition] = useTransition();

  const errorsByPath = useMemo(() => {
    const map = new Map<string, KeyedError[]>();
    for (const e of fieldErrors) {
      const list = map.get(e.fieldId) ?? [];
      list.push(e);
      map.set(e.fieldId, list);
    }
    return map;
  }, [fieldErrors]);

  // ---------- Top-level (main) state mutators ----------

  function setTopValue(fieldId: string, value: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  }

  function setSubRowValue(parentId: string, idx: number, fieldId: string, value: unknown) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as FormValues[])] : [];
      const row = { ...(rows[idx] ?? {}), [fieldId]: value };
      rows[idx] = row;
      return { ...prev, [parentId]: rows };
    });
  }

  function addRepeatingRow(parentId: string, fields: LeafField[]) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as FormValues[])] : [];
      rows.push(newSubRow(fields));
      return { ...prev, [parentId]: rows };
    });
    setRowKeys((prev) => ({
      ...prev,
      [parentId]: [...(prev[parentId] ?? []), crypto.randomUUID()],
    }));
  }

  function removeRepeatingRow(parentId: string, idx: number) {
    setValues((prev) => {
      const rows = Array.isArray(prev[parentId]) ? [...(prev[parentId] as FormValues[])] : [];
      rows.splice(idx, 1);
      return { ...prev, [parentId]: rows };
    });
    setRowKeys((prev) => ({
      ...prev,
      [parentId]: (prev[parentId] ?? []).filter((_, i) => i !== idx),
    }));
  }

  // ---------- Sub-template scoped mutators ----------

  function setSubFieldValue(subId: string, fieldId: string, value: unknown) {
    setSubValues((prev) => ({
      ...prev,
      [subId]: { ...(prev[subId] ?? {}), [fieldId]: value },
    }));
  }

  function setSubRepeatingRowValue(
    subId: string,
    parentId: string,
    idx: number,
    fieldId: string,
    value: unknown,
  ) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as FormValues[])] : [];
      const row = { ...(rows[idx] ?? {}), [fieldId]: value };
      rows[idx] = row;
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
  }

  function addSubRepeatingRow(subId: string, parentId: string, fields: LeafField[]) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as FormValues[])] : [];
      rows.push(newSubRow(fields));
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
    setSubRowKeys((prev) => {
      const scope = prev[subId] ?? {};
      return {
        ...prev,
        [subId]: { ...scope, [parentId]: [...(scope[parentId] ?? []), crypto.randomUUID()] },
      };
    });
  }

  function removeSubRepeatingRow(subId: string, parentId: string, idx: number) {
    setSubValues((prev) => {
      const scope = prev[subId] ?? {};
      const rows = Array.isArray(scope[parentId]) ? [...(scope[parentId] as FormValues[])] : [];
      rows.splice(idx, 1);
      return { ...prev, [subId]: { ...scope, [parentId]: rows } };
    });
    setSubRowKeys((prev) => {
      const scope = prev[subId] ?? {};
      return {
        ...prev,
        [subId]: { ...scope, [parentId]: (scope[parentId] ?? []).filter((_, i) => i !== idx) },
      };
    });
  }

  // ---------- Submit ----------

  function submitWith(action: "save_draft" | "submit") {
    setServerError(null);
    setFieldErrors([]);

    const mode = action === "submit" ? "submit" : "draft";
    const combined: FormValues = { ...values };
    if (subTemplates.length > 0) combined.subs = subValues;

    const local =
      subTemplates.length > 0
        ? validateComposedFormValues(
            {
              main: template.formSchema,
              subTemplates: subTemplates.map((s) => ({ id: s.id, schema: s.formSchema })),
            } satisfies ComposedSchema,
            combined,
            { mode },
          )
        : validateFormValues(template.formSchema, values, { mode });

    if (!local.ok) {
      setFieldErrors(attachKeys(local.errors));
      setServerError("Corrija os campos assinalados antes de continuar.");
      return;
    }

    startTransition(async () => {
      const result = recordId
        ? await submitRecordAction({
            mode: "update",
            id: recordId,
            values: local.values,
            action,
          })
        : await submitRecordAction({
            mode: "create",
            templateId: template.id,
            values: local.values,
            asDraft: action === "save_draft",
          });

      if (result.ok) {
        if (action === "submit") {
          router.push(`/records/${result.id}`);
        } else if (!recordId) {
          router.push(`/records/${result.id}`);
        } else {
          router.refresh();
        }
        return;
      }

      setServerError(translateError(result.error));
      if (result.fieldErrors) setFieldErrors(attachKeys(result.fieldErrors));
    });
  }

  if (readOnly) {
    return (
      <ReadOnlyView
        template={template}
        values={values}
        subTemplates={subTemplates}
        subValues={subValues}
        status={initialStatus ?? "submitted"}
      />
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submitWith("submit");
      }}
      className="space-y-4"
    >
      {template.formSchema.rows.map((row) => (
        <fieldset key={row.id} className="space-y-3 rounded-lg border bg-card p-4">
          {row.label && <legend className="px-2 text-xs text-muted-foreground">{row.label}</legend>}
          {row.fields.map((field) => (
            <FieldInput
              key={field.id}
              field={field}
              scopeValues={values}
              value={values[field.id]}
              pathPrefix=""
              errorsByPath={errorsByPath}
              rowKeys={field.kind === "repeating" ? (rowKeys[field.id] ?? []) : undefined}
              onChange={(v) => setTopValue(field.id, v)}
              onSubChange={(idx, subId, v) => setSubRowValue(field.id, idx, subId, v)}
              onAddRow={() => field.kind === "repeating" && addRepeatingRow(field.id, field.fields)}
              onRemoveRow={(idx) => removeRepeatingRow(field.id, idx)}
            />
          ))}
        </fieldset>
      ))}

      {subTemplates.map((sub) => (
        <section
          key={sub.id}
          className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
        >
          <header>
            <h2 className="text-base font-semibold">{sub.name}</h2>
            <p className="text-xs text-muted-foreground">Secção do sub-modelo</p>
          </header>
          {sub.formSchema.rows.map((row) => (
            <fieldset key={row.id} className="space-y-3 rounded-md border bg-background p-3">
              {row.label && (
                <legend className="px-2 text-xs text-muted-foreground">{row.label}</legend>
              )}
              {row.fields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  scopeValues={subValues[sub.id] ?? {}}
                  value={subValues[sub.id]?.[field.id]}
                  pathPrefix={`subs.${sub.id}.`}
                  errorsByPath={errorsByPath}
                  rowKeys={
                    field.kind === "repeating" ? (subRowKeys[sub.id]?.[field.id] ?? []) : undefined
                  }
                  onChange={(v) => setSubFieldValue(sub.id, field.id, v)}
                  onSubChange={(idx, subFieldId, v) =>
                    setSubRepeatingRowValue(sub.id, field.id, idx, subFieldId, v)
                  }
                  onAddRow={() =>
                    field.kind === "repeating" && addSubRepeatingRow(sub.id, field.id, field.fields)
                  }
                  onRemoveRow={(idx) => removeSubRepeatingRow(sub.id, field.id, idx)}
                />
              ))}
            </fieldset>
          ))}
        </section>
      ))}

      {serverError && <Alert variant="destructive">{serverError}</Alert>}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => submitWith("save_draft")}
          disabled={isPending}
        >
          {isPending ? "A guardar…" : "Guardar rascunho"}
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "A submeter…" : "Submeter"}
        </Button>
      </div>
    </form>
  );
}
