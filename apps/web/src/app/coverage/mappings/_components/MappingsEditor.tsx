"use client";

import { createMapping, deleteMapping } from "@/lib/coverage-actions";
import {
  FRAMEWORK_LABEL,
  type Framework,
  type FrameworkDatapoint,
  type TemplateDatapointMapping,
} from "@/lib/coverage-types";
import { Add } from "@carbon/icons-react";
import { Button, InlineNotification, Tag, Tile } from "@carbon/react";
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
      <InlineNotification
        kind="info"
        title="Sem modelos"
        subtitle="Ainda não existem modelos publicados para mapear."
        lowContrast
        hideCloseButton
      />
    );
  }

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <InlineNotification
          kind="error"
          title="Erro"
          subtitle={errorMessage}
          lowContrast
          hideCloseButton
        />
      ) : null}

      {templates.map((tpl) => {
        const mapped = mappingsByTemplate.get(tpl.id) ?? [];
        const isOpen = openTemplateId === tpl.id;
        const alreadyMappedIds = new Set(mapped.map((m) => m.frameworkDatapointId));
        const pickerOptions = datapoints.filter(
          (dp) => dp.framework === pickerFramework && !alreadyMappedIds.has(dp.id),
        );
        return (
          <Tile key={tpl.id}>
            <h3 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
              {tpl.name}
            </h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {mapped.length === 0 ? (
                <span className="text-xs text-neutral-600">Sem datapoints mapeados.</span>
              ) : (
                mapped.map((m) => {
                  const dp = datapointById.get(m.frameworkDatapointId);
                  return (
                    <Tag
                      key={m.id}
                      type="cool-gray"
                      filter
                      onClose={() => remove.mutate(m.id)}
                    >
                      {dp ? `${FRAMEWORK_LABEL[dp.framework]} ${dp.code}` : m.frameworkDatapointId}
                    </Tag>
                  );
                })
              )}
            </div>

            <div className="mt-3">
              {!isOpen ? (
                <Button
                  kind="tertiary"
                  size="sm"
                  onClick={() => setOpenTemplateId(tpl.id)}
                  renderIcon={Add}
                >
                  Adicionar datapoint
                </Button>
              ) : (
                <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50 p-3">
                  <div className="flex gap-1">
                    {FRAMEWORKS.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setPickerFramework(f)}
                        className={`rounded px-2 py-1 text-xs font-medium ${
                          pickerFramework === f
                            ? "bg-[var(--cds-interactive)] text-[#37323e]"
                            : "text-neutral-600 hover:text-neutral-900"
                        }`}
                      >
                        {FRAMEWORK_LABEL[f]}
                      </button>
                    ))}
                  </div>
                  <div className="max-h-64 space-y-1 overflow-y-auto">
                    {pickerOptions.length === 0 ? (
                      <p className="text-xs text-neutral-600">
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
                          className="flex w-full items-baseline gap-2 rounded px-2 py-1 text-left text-sm hover:bg-neutral-100"
                        >
                          <span
                            className="text-xs text-neutral-600"
                            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                          >
                            {dp.code}
                          </span>
                          <span>{dp.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                  <Button kind="ghost" size="sm" onClick={() => setOpenTemplateId(null)}>
                    Fechar
                  </Button>
                </div>
              )}
            </div>
          </Tile>
        );
      })}
    </div>
  );
}
