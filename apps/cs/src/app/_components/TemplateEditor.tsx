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
import { createTemplateAction } from "../actions";
import {
  type EditorField,
  type EditorFieldKind,
  type EditorLeafKind,
  type EditorRow,
  type EditorShowIfPredicate,
  buildFormSchema,
  newField,
  newRow,
  newShowIf,
} from "./template-editor-build";

const TOP_LEVEL_KINDS: Array<{ value: EditorFieldKind; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "calculated", label: "Calculado" },
  { value: "repeating", label: "Linhas repetidas" },
];

const LEAF_KINDS: Array<{ value: EditorLeafKind; label: string }> = [
  { value: "text", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "date", label: "Data" },
  { value: "select", label: "Lista" },
  { value: "multi_select", label: "Múltipla escolha" },
  { value: "calculated", label: "Calculado" },
];

const MAPPABLE_KINDS: ReadonlySet<EditorFieldKind> = new Set(["text", "number", "date", "select"]);

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

interface FieldCardProps {
  field: EditorField;
  fieldIdx: number;
  siblings: EditorField[];
  allowRepeating: boolean;
  removable: boolean;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
  onPatch: (patch: Partial<EditorField>) => void;
  onRemove: () => void;
  onPatchSub?: (subIdx: number, patch: Partial<EditorField>) => void;
}

function FieldCard({
  field,
  fieldIdx,
  siblings,
  allowRepeating,
  removable,
  availableTemplates,
  onPatch,
  onRemove,
  onPatchSub,
}: FieldCardProps) {
  const kindOptions = allowRepeating ? TOP_LEVEL_KINDS : LEAF_KINDS;
  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Identificador (snake_case)</Label>
          <Input
            value={field.id}
            onChange={(e) => onPatch({ id: e.target.value })}
            placeholder="ex.: kwh_consumo"
            className="font-mono"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Etiqueta</Label>
          <Input
            value={field.label}
            onChange={(e) => onPatch({ label: e.target.value })}
            placeholder="ex.: Consumo de eletricidade"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={field.kind}
            onChange={(e) => onPatch({ kind: e.target.value as EditorFieldKind })}
            className="h-8 w-auto py-0 text-sm"
          >
            {kindOptions.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
        </div>
        {field.kind !== "repeating" && (
          <label className="inline-flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onPatch({ required: e.target.checked })}
              className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
            />
            <span>Obrigatório</span>
          </label>
        )}
      </div>

      {field.kind === "text" && (
        <div className="max-w-xs space-y-1">
          <Label className="text-xs">Comprimento máximo</Label>
          <Input
            type="number"
            min={1}
            value={field.maxLength}
            onChange={(e) => onPatch({ maxLength: e.target.value })}
          />
        </div>
      )}

      {field.kind === "number" && (
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Unidade</Label>
            <Input
              value={field.unit}
              onChange={(e) => onPatch({ unit: e.target.value })}
              placeholder="kWh, m³, kg…"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Mínimo</Label>
            <Input
              type="number"
              value={field.min}
              onChange={(e) => onPatch({ min: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Máximo</Label>
            <Input
              type="number"
              value={field.max}
              onChange={(e) => onPatch({ max: e.target.value })}
            />
          </div>
        </div>
      )}

      {field.kind === "date" && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Data mínima</Label>
            <Input
              type="date"
              value={field.min}
              onChange={(e) => onPatch({ min: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Data máxima</Label>
            <Input
              type="date"
              value={field.max}
              onChange={(e) => onPatch({ max: e.target.value })}
            />
          </div>
        </div>
      )}

      {(field.kind === "select" || field.kind === "multi_select") && (
        <OptionsEditor field={field} onPatch={onPatch} />
      )}

      {field.kind === "multi_select" && (
        <div className="grid max-w-md grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Mínimo de seleções</Label>
            <Input
              type="number"
              min={1}
              value={field.minSelected}
              onChange={(e) => onPatch({ minSelected: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Máximo de seleções</Label>
            <Input
              type="number"
              min={1}
              value={field.maxSelected}
              onChange={(e) => onPatch({ maxSelected: e.target.value })}
            />
          </div>
        </div>
      )}

      {field.kind === "calculated" && <CalculatedEditor field={field} onPatch={onPatch} />}

      {field.kind === "repeating" && (
        <RepeatingEditor
          field={field}
          fieldIdx={fieldIdx}
          onPatch={onPatch}
          onPatchSub={onPatchSub}
          availableTemplates={availableTemplates}
        />
      )}

      <ShowIfPicker field={field} siblings={siblings} onPatch={onPatch} />

      {MAPPABLE_KINDS.has(field.kind) && (
        <SourceMappingPicker
          field={field}
          availableTemplates={availableTemplates}
          onPatch={onPatch}
        />
      )}

      <div className="flex justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={!removable}>
          Remover campo
        </Button>
      </div>
    </div>
  );
}

function OptionsEditor({
  field,
  onPatch,
}: {
  field: EditorField;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  function update(idx: number, patch: { value?: string; label?: string }) {
    onPatch({ options: field.options.map((o, i) => (i === idx ? { ...o, ...patch } : o)) });
  }
  function remove(idx: number) {
    onPatch({ options: field.options.filter((_, i) => i !== idx) });
  }
  return (
    <div className="space-y-2">
      <Label className="text-xs">Opções</Label>
      {field.options.length === 0 && (
        <p className="text-xs text-muted-foreground">Sem opções ainda — adicione pelo menos uma.</p>
      )}
      {field.options.map((opt, optIdx) => (
        <div key={`${field.uiKey}-opt-${optIdx}`} className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <Input
            placeholder="valor"
            value={opt.value}
            onChange={(e) => update(optIdx, { value: e.target.value })}
            className="font-mono"
          />
          <Input
            placeholder="etiqueta"
            value={opt.label}
            onChange={(e) => update(optIdx, { label: e.target.value })}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => remove(optIdx)}>
            ✕
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPatch({ options: [...field.options, { value: "", label: "" }] })}
      >
        + Opção
      </Button>
    </div>
  );
}

function CalculatedEditor({
  field,
  onPatch,
}: {
  field: EditorField;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <Label className="text-xs">Expressão (referencie outros campos pelo identificador)</Label>
        <Textarea
          value={field.expression}
          onChange={(e) => onPatch({ expression: e.target.value })}
          rows={2}
          placeholder="ex.: actividade * factor"
          className="font-mono"
        />
      </div>
      <div className="max-w-xs space-y-1">
        <Label className="text-xs">Unidade (opcional)</Label>
        <Input
          value={field.unit}
          onChange={(e) => onPatch({ unit: e.target.value })}
          placeholder="kg CO₂e, kWh…"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Operadores suportados: <code className="font-mono">+ - * /</code> e parênteses. Os
        identificadores devem existir no mesmo âmbito (linha principal ou sub-linha).
      </p>
    </div>
  );
}

function RepeatingEditor({
  field,
  fieldIdx: _fieldIdx,
  onPatch,
  onPatchSub,
  availableTemplates,
}: {
  field: EditorField;
  fieldIdx: number;
  onPatch: (patch: Partial<EditorField>) => void;
  onPatchSub?: (subIdx: number, patch: Partial<EditorField>) => void;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
}) {
  return (
    <div className="space-y-3 rounded-md border border-dashed bg-muted/40 p-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Nome de cada linha</Label>
          <Input
            value={field.rowLabel}
            onChange={(e) => onPatch({ rowLabel: e.target.value })}
            placeholder="ex.: Veículo"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Mínimo de linhas</Label>
          <Input
            type="number"
            min={0}
            value={field.minRows}
            onChange={(e) => onPatch({ minRows: e.target.value })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Máximo de linhas</Label>
          <Input
            type="number"
            min={1}
            value={field.maxRows}
            onChange={(e) => onPatch({ maxRows: e.target.value })}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Sub-campos (não podem conter outras linhas repetidas):
      </p>

      {field.subFields.map((sub, subIdx) => (
        <FieldCard
          key={sub.uiKey}
          field={sub}
          fieldIdx={subIdx}
          siblings={field.subFields.slice(0, subIdx)}
          allowRepeating={false}
          availableTemplates={availableTemplates}
          removable={field.subFields.length > 1}
          onPatch={(patch) => onPatchSub?.(subIdx, patch)}
          onRemove={() => onPatch({ subFields: field.subFields.filter((_, i) => i !== subIdx) })}
        />
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onPatch({ subFields: [...field.subFields, newField()] })}
      >
        + Sub-campo
      </Button>
    </div>
  );
}

function ShowIfPicker({
  field,
  siblings,
  onPatch,
}: {
  field: EditorField;
  siblings: EditorField[];
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  const candidates = siblings.filter((s) => s.id.trim() && s.kind !== "repeating");

  function update(idx: number, patch: Partial<EditorShowIfPredicate>) {
    onPatch({ showIf: field.showIf.map((p, i) => (i === idx ? { ...p, ...patch } : p)) });
  }
  function remove(idx: number) {
    onPatch({ showIf: field.showIf.filter((_, i) => i !== idx) });
  }

  return (
    <details className="border-t border-dotted pt-3">
      <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
        Condição de visibilidade {field.showIf.length > 0 && `(${field.showIf.length})`}
      </summary>
      <div className="mt-2 space-y-2">
        {field.showIf.length > 0 && candidates.length === 0 && (
          <p className="text-xs text-destructive">
            Não existem campos anteriores neste âmbito para usar como referência. Reorganize os
            campos ou remova as condições.
          </p>
        )}
        {field.showIf.map((predicate, idx) => (
          <div key={predicate.uiKey} className="grid grid-cols-[1fr_1fr_auto] gap-2">
            <Select
              value={predicate.fieldId}
              onChange={(e) => update(idx, { fieldId: e.target.value })}
              className="h-8 text-xs"
            >
              <option value="">— campo anterior —</option>
              {candidates.map((c) => (
                <option key={c.uiKey} value={c.id.trim()}>
                  {c.id.trim()} ({c.label || "?"})
                </option>
              ))}
            </Select>
            <Input
              placeholder="valor exacto"
              value={predicate.equals}
              onChange={(e) => update(idx, { equals: e.target.value })}
              className="h-8 text-xs"
            />
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(idx)}>
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onPatch({ showIf: [...field.showIf, newShowIf()] })}
          disabled={candidates.length === 0 && field.showIf.length === 0}
        >
          + Condição (E)
        </Button>
        <p className="text-xs text-muted-foreground">
          Todas as condições devem ser satisfeitas (E lógico). Campos ocultos não são validados.
        </p>
      </div>
    </details>
  );
}

function SourceMappingPicker({
  field,
  availableTemplates,
  onPatch,
}: {
  field: EditorField;
  availableTemplates: Array<Pick<RecordTemplate, "id" | "name" | "status" | "formSchema">>;
  onPatch: (patch: Partial<EditorField>) => void;
}) {
  const mapping = field.sourceMapping;
  const eligibleTemplates = availableTemplates.filter((t) => t.status !== "archived");
  const selectedTemplate = mapping
    ? availableTemplates.find((t) => t.id === mapping.sourceTemplateId)
    : undefined;
  const sourceFields = selectedTemplate
    ? selectedTemplate.formSchema.rows.flatMap((r) => r.fields).filter((f) => f.kind === field.kind)
    : [];

  return (
    <details className="border-t border-dotted pt-3">
      <summary
        className={cn(
          "cursor-pointer text-xs text-muted-foreground hover:text-foreground",
          mapping && "text-violet-700",
        )}
      >
        Pré-preencher de outro modelo {mapping && "(activo)"}
      </summary>
      <div className="mt-2 space-y-2">
        {eligibleTemplates.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Não existem outros modelos disponíveis na organização.
          </p>
        ) : (
          <>
            <div className="space-y-1">
              <Label className="text-xs">Modelo de origem</Label>
              <Select
                value={mapping?.sourceTemplateId ?? ""}
                onChange={(e) => {
                  const sourceTemplateId = e.target.value;
                  onPatch({
                    sourceMapping: sourceTemplateId
                      ? { sourceTemplateId, sourceFieldId: "" }
                      : null,
                  });
                }}
                className="h-8 text-xs"
              >
                <option value="">— sem pré-preenchimento —</option>
                {eligibleTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </div>
            {mapping && selectedTemplate && (
              <div className="space-y-1">
                <Label className="text-xs">
                  Campo de origem (tipo deve coincidir: {field.kind})
                </Label>
                <Select
                  value={mapping.sourceFieldId}
                  onChange={(e) =>
                    onPatch({
                      sourceMapping: { ...mapping, sourceFieldId: e.target.value },
                    })
                  }
                  className="h-8 text-xs"
                >
                  <option value="">— escolha um campo —</option>
                  {sourceFields.map((sf) => (
                    <option key={sf.id} value={sf.id}>
                      {sf.id} ({sf.label})
                    </option>
                  ))}
                </Select>
                {sourceFields.length === 0 && (
                  <p className="text-xs text-destructive">
                    O modelo "{selectedTemplate.name}" não tem campos do tipo {field.kind}.
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Ao criar um novo registo, este campo é pré-preenchido com o valor do campo escolhido
              no registo submetido mais recente do modelo de origem.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
