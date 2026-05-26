"use client";

import { createTemplateAction } from "@/app/actions";
import {
  Add,
  ArrowDown,
  ArrowUp,
  Checkmark,
  TrashCan,
  View,
} from "@carbon/icons-react";
import {
  Button,
  Checkbox,
  InlineNotification,
  Select,
  SelectItem,
  Stack,
  TextArea,
  TextInput,
} from "@carbon/react";
import type { FormSchema, RecordTemplate, Topic } from "@bgreen/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  type PreviewSubTemplate,
  TemplatePreview,
} from "../../../_components/TemplatePreview/TemplatePreview";
import { FieldCard } from "./FieldCard";
import {
  type EditorField,
  type EditorRow,
  buildFormSchema,
  newField,
  newRow,
} from "./template-editor-build";

interface TemplateEditorProps {
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
  subTemplates: Array<Pick<RecordTemplate, "id" | "name" | "topicTagId">>;
  topics: Topic[];
}

type WorkflowOption = "single-step-submit" | "two-step-review" | "three-step-certify";

const WORKFLOW_OPTIONS: Array<{ value: WorkflowOption; label: string; hint: string }> = [
  {
    value: "two-step-review",
    label: "Revisão (2 passos)",
    hint: "Rascunho → submetido → aprovado/alterações/rejeitado",
  },
  {
    value: "single-step-submit",
    label: "Submissão simples (1 passo)",
    hint: "Rascunho → submetido (sem revisão)",
  },
  {
    value: "three-step-certify",
    label: "Certificação (3 passos)",
    hint: "Adiciona certificação por terceiro após aprovação",
  },
];

export function TemplateEditor({ availableTemplates, subTemplates, topics }: TemplateEditorProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [workflowDefinitionId, setWorkflowDefinitionId] =
    useState<WorkflowOption>("two-step-review");
  const [topicTagId, setTopicTagId] = useState<string>("");
  const [isSubTemplate, setIsSubTemplate] = useState(false);
  const [composedIds, setComposedIds] = useState<string[]>([]);
  const [rows, setRows] = useState<EditorRow[]>([newRow()]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [preview, setPreview] = useState<{
    schema: FormSchema;
    subs: PreviewSubTemplate[];
  } | null>(null);

  function openPreview() {
    setError(null);
    if (isSubTemplate && composedIds.length > 0) {
      setError("Um sub-template não pode compor outros sub-templates.");
      return;
    }
    const built = buildFormSchema(rows);
    if (!("ok" in built)) {
      setError(built.message);
      return;
    }
    const subs: PreviewSubTemplate[] = isSubTemplate
      ? []
      : composedIds.flatMap((subId) => {
          const meta = availableTemplates.find((t) => t.id === subId);
          if (!meta) return [];
          return [{ id: meta.id, name: meta.name, formSchema: meta.formSchema }];
        });
    setPreview({ schema: built.schema, subs });
  }

  function toggleSub(id: string) {
    setComposedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function moveSub(id: string, direction: -1 | 1) {
    setComposedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const target = idx + direction;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[target]] = [next[target] as string, next[idx] as string];
      return next;
    });
  }

  function patchField(rowIdx: number, fieldIdx: number, patch: Partial<EditorField>) {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIdx
          ? r
          : { ...r, fields: r.fields.map((f, j) => (j === fieldIdx ? { ...f, ...patch } : f)) },
      ),
    );
  }

  function patchSubField(
    rowIdx: number,
    fieldIdx: number,
    subIdx: number,
    patch: Partial<EditorField>,
  ) {
    setRows((prev) =>
      prev.map((r, i) =>
        i !== rowIdx
          ? r
          : {
              ...r,
              fields: r.fields.map((f, j) =>
                j !== fieldIdx
                  ? f
                  : {
                      ...f,
                      subFields: f.subFields.map((s, k) => (k === subIdx ? { ...s, ...patch } : s)),
                    },
              ),
            },
      ),
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Indique um nome para o modelo.");
      return;
    }
    const built = buildFormSchema(rows);
    if (!("ok" in built)) {
      setError(built.message);
      return;
    }
    if (isSubTemplate && composedIds.length > 0) {
      setError("Um sub-template não pode compor outros sub-templates.");
      return;
    }
    startTransition(async () => {
      const result = await createTemplateAction(
        { error: null, created: null },
        {
          name: name.trim(),
          description: description.trim() || null,
          formSchema: built.schema,
          workflowDefinitionId,
          topicTagId: topicTagId === "" ? null : topicTagId,
          isSubTemplate,
          composedSubTemplateIds: isSubTemplate ? [] : composedIds,
        },
      );
      if (result.error) {
        setError(result.error);
        return;
      }
      if (result.created) {
        router.push(`/templates/${result.created.id}`);
      }
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Stack gap={8}>
        <TextInput
          id="tpl-name"
          labelText="Nome"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <TextArea
          id="tpl-description"
          labelText="Descrição (opcional)"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />

        <Select
          id="tpl-workflow"
          labelText="Fluxo de aprovação"
          value={workflowDefinitionId}
          onChange={(e) => setWorkflowDefinitionId(e.target.value as WorkflowOption)}
          helperText={WORKFLOW_OPTIONS.find((o) => o.value === workflowDefinitionId)?.hint}
        >
          {WORKFLOW_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} text={opt.label} />
          ))}
        </Select>

        <Select
          id="tpl-topic"
          labelText="Tópico (opcional)"
          value={topicTagId}
          onChange={(e) => setTopicTagId(e.target.value)}
          helperText="Etiqueta para filtrar e segmentar este modelo por área (HR, financeiro, …)."
        >
          <SelectItem value="" text="— sem tópico —" />
          {topics.map((t) => (
            <SelectItem key={t.id} value={t.id} text={`${t.name} (${t.slug})`} />
          ))}
        </Select>

        <Checkbox
          id="tpl-is-sub"
          labelText="É sub-template (não submetido directamente; embebido noutros modelos)"
          checked={isSubTemplate}
          onChange={(_e, { checked }) => {
            setIsSubTemplate(checked);
            if (checked) setComposedIds([]);
          }}
        />

        {!isSubTemplate && subTemplates.length > 0 && (
          <section className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4">
            <div>
              <h2 className="text-lg font-medium">Sub-templates incluídos</h2>
              <p className="text-xs text-neutral-600">
                Os campos do sub-template aparecem no formulário, depois dos campos deste modelo.
                Reordenar afecta a ordem de apresentação.
              </p>
            </div>
            <ol className="space-y-2">
              {subTemplates.map((sub) => {
                const idx = composedIds.indexOf(sub.id);
                const selected = idx >= 0;
                return (
                  <li
                    key={sub.id}
                    className={`flex items-center justify-between gap-3 rounded-md border p-2 text-sm ${
                      selected
                        ? "border-l-2 border-l-[var(--cds-interactive)] border-neutral-200 bg-neutral-50"
                        : "border-neutral-200 bg-neutral-50"
                    }`}
                  >
                    <Checkbox
                      id={`tpl-sub-${sub.id}`}
                      labelText={sub.name}
                      checked={selected}
                      onChange={() => toggleSub(sub.id)}
                    />
                    {selected && (
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-neutral-600">posição {idx + 1}</span>
                        <Button
                          type="button"
                          kind="ghost"
                          size="sm"
                          onClick={() => moveSub(sub.id, -1)}
                          disabled={idx === 0}
                          renderIcon={ArrowUp}
                          iconDescription="Mover para cima"
                          hasIconOnly
                        />
                        <Button
                          type="button"
                          kind="ghost"
                          size="sm"
                          onClick={() => moveSub(sub.id, 1)}
                          disabled={idx === composedIds.length - 1}
                          renderIcon={ArrowDown}
                          iconDescription="Mover para baixo"
                          hasIconOnly
                        />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </section>
        )}

        <section className="space-y-5">
          <h2 className="text-lg font-medium">Linhas e campos</h2>
          {rows.map((row, rowIdx) => (
            <fieldset
              key={row.uiKey}
              className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5"
            >
              <legend className="px-2 text-xs uppercase tracking-wide text-neutral-600">
                Linha {rowIdx + 1}
              </legend>

              <TextInput
                id={`row-label-${row.uiKey}`}
                labelText="Etiqueta da linha (opcional)"
                value={row.label}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === rowIdx ? { ...r, label: e.target.value } : r)),
                  )
                }
              />

              {row.fields.map((field, fieldIdx) => (
                <FieldCard
                  key={field.uiKey}
                  field={field}
                  fieldIdx={fieldIdx}
                  siblings={row.fields.slice(0, fieldIdx)}
                  allowRepeating
                  availableTemplates={availableTemplates}
                  onPatch={(patch) => patchField(rowIdx, fieldIdx, patch)}
                  onRemove={() =>
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i !== rowIdx
                          ? r
                          : { ...r, fields: r.fields.filter((_, j) => j !== fieldIdx) },
                      ),
                    )
                  }
                  removable={row.fields.length > 1 || rows.length > 1}
                  onPatchSub={(subIdx, patch) => patchSubField(rowIdx, fieldIdx, subIdx, patch)}
                />
              ))}

              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  kind="tertiary"
                  size="sm"
                  onClick={() =>
                    setRows((prev) =>
                      prev.map((r, i) =>
                        i === rowIdx ? { ...r, fields: [...r.fields, newField()] } : r,
                      ),
                    )
                  }
                  renderIcon={Add}
                >
                  Adicionar campo
                </Button>
                {rows.length > 1 && (
                  <Button
                    type="button"
                    kind="danger--ghost"
                    size="sm"
                    onClick={() => setRows((prev) => prev.filter((_, i) => i !== rowIdx))}
                    renderIcon={TrashCan}
                  >
                    Remover linha
                  </Button>
                )}
              </div>
            </fieldset>
          ))}

          <Button
            type="button"
            kind="tertiary"
            size="sm"
            onClick={() => setRows((prev) => [...prev, newRow()])}
            renderIcon={Add}
          >
            Adicionar linha
          </Button>
        </section>

        {error && (
          <InlineNotification
            kind="error"
            title="Não foi possível guardar"
            subtitle={error}
            lowContrast
            hideCloseButton
          />
        )}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            kind="tertiary"
            size="lg"
            onClick={openPreview}
            renderIcon={View}
            disabled={isPending}
          >
            Pré-visualizar
          </Button>
          <Button type="submit" kind="primary" size="lg" disabled={isPending} renderIcon={Checkmark}>
            {isPending ? "A criar…" : "Criar modelo"}
          </Button>
        </div>
      </Stack>

      <TemplatePreview
        open={preview !== null}
        onClose={() => setPreview(null)}
        templateName={name}
        formSchema={preview?.schema ?? { version: 1, rows: [] }}
        subTemplates={preview?.subs ?? []}
      />
    </form>
  );
}
