"use client";

// CS-only mapping editor. The page bundles templates + datapoints +
// existing mappings; this client component owns:
//   - per-template list of mapped datapoints (chips with X to remove)
//   - "+ Adicionar datapoint" picker that opens a framework-scoped
//     selector
//   - optimistic UI via tanstack-query mutations

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  createMapping,
  deleteMapping,
} from "@/lib/coverage-actions";
import {
  FRAMEWORK_LABEL,
  type Framework,
  type FrameworkDatapoint,
  type TemplateDatapointMapping,
} from "@/lib/coverage-types";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

interface MappingsEditorProps {
  templates: Array<{ id: string; name: string }>;
  datapoints: FrameworkDatapoint[];
  mappings: TemplateDatapointMapping[];
}

const FRAMEWORKS: Framework[] = ["esrs", "ghg", "gri"];

export function MappingsEditor({
  templates,
  datapoints,
  mappings,
}: MappingsEditorProps) {
  const router = useRouter();
  const [openTemplateId, setOpenTemplateId] = useState<string | null>(null);
  const [pickerFramework, setPickerFramework] = useState<Framework>("esrs");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const datapointById = useMemo(() => {
    const m = new Map<string, FrameworkDatapoint>();
    for (const dp of datapoints) m.set(dp.id, dp);
    return m;
  }, [datapoints]);

  const mappingsByTemplate = useMemo(() => {
    const m = new Map<string, TemplateDatapointMapping[]>();
    for (const map of mappings) {
      const list = m.get(map.templateId) ?? [];
      list.push(map);
      m.set(map.templateId, list);
    }
    return m;
  }, [mappings]);

  const add = useMutation({
    mutationFn: (input: { templateId: string; frameworkDatapointId: string }) =>
      createMapping(input),
    onSuccess: () => {
      setErrorMessage(null);
      router.refresh();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "request_failed";
      setErrorMessage(
        msg === "forbidden"
          ? "Apenas administradores de serviços centrais podem editar mapeamentos."
          : "Não foi possível guardar o mapeamento. Tente novamente.",
      );
    },
  });

  const remove = useMutation({
    mutationFn: (mappingId: string) => deleteMapping(mappingId),
    onSuccess: () => {
      setErrorMessage(null);
      router.refresh();
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "request_failed";
      setErrorMessage(
        msg === "forbidden"
          ? "Apenas administradores de serviços centrais podem editar mapeamentos."
          : "Não foi possível remover o mapeamento. Tente novamente.",
      );
    },
  });

  if (templates.length === 0) {
    return (
      <Alert variant="info">
        Ainda não existem modelos publicados para mapear.
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage ? <Alert variant="destructive">{errorMessage}</Alert> : null}

      {templates.map((tpl) => {
        const mapped = mappingsByTemplate.get(tpl.id) ?? [];
        const isOpen = openTemplateId === tpl.id;
        const alreadyMappedIds = new Set(mapped.map((m) => m.frameworkDatapointId));
        const pickerOptions = datapoints.filter(
          (dp) => dp.framework === pickerFramework && !alreadyMappedIds.has(dp.id),
        );
        return (
          <Card key={tpl.id}>
            <CardHeader>
              <CardTitle className="text-base">{tpl.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {mapped.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    Sem datapoints mapeados.
                  </span>
                ) : (
                  mapped.map((m) => {
                    const dp = datapointById.get(m.frameworkDatapointId);
                    return (
                      <Badge
                        key={m.id}
                        variant="secondary"
                        className="flex items-center gap-1"
                      >
                        <span>
                          {dp ? `${FRAMEWORK_LABEL[dp.framework]} ${dp.code}` : m.frameworkDatapointId}
                        </span>
                        <button
                          type="button"
                          onClick={() => remove.mutate(m.id)}
                          disabled={remove.isPending}
                          className="ml-1 text-xs text-muted-foreground hover:text-destructive"
                          aria-label={`Remover ${dp?.code ?? m.frameworkDatapointId}`}
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })
                )}
              </div>

              <div>
                {!isOpen ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setOpenTemplateId(tpl.id)}
                  >
                    + Adicionar datapoint
                  </Button>
                ) : (
                  <div className="space-y-2 rounded-md border bg-muted/20 p-3">
                    <div className="flex gap-1">
                      {FRAMEWORKS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setPickerFramework(f)}
                          className={cn(
                            "rounded px-2 py-1 text-xs font-medium",
                            pickerFramework === f
                              ? "bg-primary text-primary-foreground"
                              : "text-muted-foreground hover:text-foreground",
                          )}
                        >
                          {FRAMEWORK_LABEL[f]}
                        </button>
                      ))}
                    </div>
                    <div className="max-h-64 space-y-1 overflow-y-auto">
                      {pickerOptions.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          Todos os datapoints deste framework já estão mapeados.
                        </p>
                      ) : (
                        pickerOptions.map((dp) => (
                          <button
                            key={dp.id}
                            type="button"
                            onClick={() =>
                              add.mutate({
                                templateId: tpl.id,
                                frameworkDatapointId: dp.id,
                              })
                            }
                            disabled={add.isPending}
                            className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          >
                            <span className="font-mono text-xs text-muted-foreground">
                              {dp.code}
                            </span>
                            <span>{dp.title}</span>
                          </button>
                        ))
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setOpenTemplateId(null)}
                    >
                      Fechar
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
