"use client";

import { Select, SelectItem } from "@carbon/react";
import type { RecordTemplate } from "@bgreen/types";
import type { EditorField } from "./template-editor-build";

export function SourceMappingPicker({
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
    <details className="border-t border-dotted border-neutral-300 pt-3">
      <summary
        className={`cursor-pointer text-xs hover:text-neutral-900 ${
          mapping ? "text-[var(--cds-link-primary)]" : "text-neutral-600"
        }`}
      >
        Pré-preencher de outro modelo {mapping && "(activo)"}
      </summary>
      <div className="mt-2 space-y-2">
        {eligibleTemplates.length === 0 ? (
          <p className="text-xs text-neutral-600">
            Não existem outros modelos disponíveis na organização.
          </p>
        ) : (
          <>
            <Select
              id={`${field.uiKey}-source-template`}
              labelText="Modelo de origem"
              size="sm"
              value={mapping?.sourceTemplateId ?? ""}
              onChange={(e) => {
                const sourceTemplateId = e.target.value;
                onPatch({
                  sourceMapping: sourceTemplateId
                    ? { sourceTemplateId, sourceFieldId: "" }
                    : null,
                });
              }}
            >
              <SelectItem value="" text="— sem pré-preenchimento —" />
              {eligibleTemplates.map((t) => (
                <SelectItem key={t.id} value={t.id} text={t.name} />
              ))}
            </Select>
            {mapping && selectedTemplate && (
              <div>
                <Select
                  id={`${field.uiKey}-source-field`}
                  labelText={`Campo de origem (tipo deve coincidir: ${field.kind})`}
                  size="sm"
                  value={mapping.sourceFieldId}
                  onChange={(e) =>
                    onPatch({
                      sourceMapping: { ...mapping, sourceFieldId: e.target.value },
                    })
                  }
                  invalid={sourceFields.length === 0}
                  invalidText={
                    sourceFields.length === 0
                      ? `O modelo "${selectedTemplate.name}" não tem campos do tipo ${field.kind}.`
                      : undefined
                  }
                >
                  <SelectItem value="" text="— escolha um campo —" />
                  {sourceFields.map((sf) => (
                    <SelectItem key={sf.id} value={sf.id} text={`${sf.id} (${sf.label})`} />
                  ))}
                </Select>
              </div>
            )}
            <p className="text-xs text-neutral-600">
              Ao criar um novo registo, este campo é pré-preenchido com o valor do campo escolhido
              no registo submetido mais recente do modelo de origem.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
