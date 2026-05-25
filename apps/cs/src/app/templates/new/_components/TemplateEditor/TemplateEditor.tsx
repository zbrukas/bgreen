"use client";

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { RecordTemplate, Topic } from "@bgreen/types";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createTemplateAction } from "@/app/actions";
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
  // V5.5: catalogue inputs. subTemplates are the templates this main template
  // can compose; topics are the tags available to attach.
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
    <form onSubmit={onSubmit} className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Novo modelo</h1>

      <div className="space-y-2">
        <Label htmlFor="tpl-name">Nome</Label>
        <Input
          id="tpl-name"
          required
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-description">Descrição (opcional)</Label>
        <Textarea
          id="tpl-description"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-workflow">Fluxo de aprovação</Label>
        <Select
          id="tpl-workflow"
          value={workflowDefinitionId}
          onChange={(e) => setWorkflowDefinitionId(e.target.value as WorkflowOption)}
        >
          {WORKFLOW_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          {WORKFLOW_OPTIONS.find((o) => o.value === workflowDefinitionId)?.hint}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="tpl-topic">Tópico (opcional)</Label>
        <Select id="tpl-topic" value={topicTagId} onChange={(e) => setTopicTagId(e.target.value)}>
          <option value="">— sem tópico —</option>
          {topics.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.slug})
            </option>
          ))}
        </Select>
        <p className="text-xs text-muted-foreground">
          Etiqueta para filtrar e segmentar este modelo por área (HR, financeiro, …).
        </p>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={isSubTemplate}
          onChange={(e) => {
            setIsSubTemplate(e.target.checked);
            if (e.target.checked) setComposedIds([]);
          }}
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        <span>É sub-template (não submetido directamente; embebido noutros modelos)</span>
      </label>

      {!isSubTemplate && subTemplates.length > 0 && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <div>
            <h2 className="text-lg font-medium">Sub-templates incluídos</h2>
            <p className="text-xs text-muted-foreground">
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
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border bg-muted/30 p-2 text-sm",
                    selected && "border-primary/50 bg-primary/5",
                  )}
                >
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleSub(sub.id)}
                      className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
                    />
                    <span>{sub.name}</span>
                  </label>
                  {selected && (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground">posição {idx + 1}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSub(sub.id, -1)}
                        disabled={idx === 0}
                      >
                        ↑
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => moveSub(sub.id, 1)}
                        disabled={idx === composedIds.length - 1}
                      >
                        ↓
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Linhas e campos</h2>
        {rows.map((row, rowIdx) => (
          <fieldset key={row.uiKey} className="space-y-3 rounded-lg border bg-card p-4">
            <legend className="px-2 text-xs text-muted-foreground">Linha {rowIdx + 1}</legend>

            <div className="space-y-1.5">
              <Label className="text-xs">Etiqueta da linha (opcional)</Label>
              <Input
                value={row.label}
                onChange={(e) =>
                  setRows((prev) =>
                    prev.map((r, i) => (i === rowIdx ? { ...r, label: e.target.value } : r)),
                  )
                }
              />
            </div>

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
                variant="outline"
                size="sm"
                onClick={() =>
                  setRows((prev) =>
                    prev.map((r, i) =>
                      i === rowIdx ? { ...r, fields: [...r.fields, newField()] } : r,
                    ),
                  )
                }
              >
                + Adicionar campo
              </Button>
              {rows.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((prev) => prev.filter((_, i) => i !== rowIdx))}
                >
                  Remover linha
                </Button>
              )}
            </div>
          </fieldset>
        ))}

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setRows((prev) => [...prev, newRow()])}
        >
          + Adicionar linha
        </Button>
      </section>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Button type="submit" disabled={isPending} size="lg">
        {isPending ? "A criar…" : "Criar modelo"}
      </Button>
    </form>
  );
}
