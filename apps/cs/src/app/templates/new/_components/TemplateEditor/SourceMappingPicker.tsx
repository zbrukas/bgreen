"use client";

import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
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
