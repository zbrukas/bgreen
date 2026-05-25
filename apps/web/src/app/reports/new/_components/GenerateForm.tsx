"use client";

// V11.4 — "Gerar relatório PDF" form.

import { getCoverageMatrix } from "@/lib/coverage-actions";
import { startReport } from "@/lib/reports-actions";
import { TEMPLATE_LABEL, type ReportTemplateId } from "@/lib/reports-types";
import { Send } from "@carbon/icons-react";
import { Button, InlineNotification, Stack, TextInput, Tile } from "@carbon/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

const TEMPLATES: ReportTemplateId[] = ["ghg-inventory", "esrs-e1", "custom"];

const TEMPLATE_DESCRIPTION: Record<ReportTemplateId, string> = {
  "ghg-inventory":
    "Inventário de emissões de gases com efeito de estufa: Âmbitos 1, 2 e 3.",
  "esrs-e1":
    "Divulgação climática CSRD/ESRS E1 — matriz de cobertura por datapoint.",
  custom:
    "Relatório personalizado com indicadores escolhidos pela sua organização.",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentYearRange(): { start: string; end: string } {
  const year = new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function previousYearRange(): { start: string; end: string } {
  const year = new Date().getFullYear() - 1;
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

function currentQuarterRange(): { start: string; end: string } {
  const now = new Date();
  const year = now.getUTCFullYear();
  const q = Math.floor(now.getUTCMonth() / 3);
  const startMonth = q * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDayByMonth: Record<number, number> = {
    1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30,
    10: 31, 11: 30, 12: 31,
  };
  const feb = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28;
  const lastDay = endMonth === 2 ? feb : (lastDayByMonth[endMonth] ?? 30);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    start: `${year}-${pad(startMonth)}-01`,
    end: `${year}-${pad(endMonth)}-${pad(lastDay)}`,
  };
}

export function GenerateForm() {
  const router = useRouter();
  const [template, setTemplate] = useState<ReportTemplateId>("ghg-inventory");
  const initialRange = useMemo(() => currentYearRange(), []);
  const [periodStart, setPeriodStart] = useState(initialRange.start);
  const [periodEnd, setPeriodEnd] = useState(initialRange.end);
  const [customTitle, setCustomTitle] = useState("");

  const coverage = useQuery({
    queryKey: ["framework-coverage", "esrs"],
    queryFn: () => getCoverageMatrix("esrs"),
    enabled: template === "esrs-e1",
    staleTime: 60_000,
  });

  const start = useMutation({
    mutationFn: () =>
      startReport({
        template,
        periodStart,
        periodEnd,
        customTitle:
          template === "custom" && customTitle.trim() !== ""
            ? customTitle.trim()
            : undefined,
      }),
    onSuccess: (row) => {
      router.push(`/reports/${row.id}`);
    },
  });

  const periodInvalid = periodStart > periodEnd;
  const customTitleMissing =
    template === "custom" && customTitle.trim() === "";
  const canSubmit = !periodInvalid && !customTitleMissing && !start.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (canSubmit) start.mutate();
      }}
    >
      <Stack gap={6}>
        <Tile>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
            Modelo
          </h2>
          <p className="mt-1 text-sm text-neutral-700">Escolha o tipo de relatório a gerar.</p>
          <div className="mt-4 space-y-2">
            {TEMPLATES.map((id) => {
              const selected = template === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTemplate(id)}
                  className={`flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors ${
                    selected
                      ? "border-[var(--cds-interactive)] bg-[var(--cds-interactive)]/10"
                      : "border-neutral-300 hover:bg-neutral-100"
                  }`}
                  aria-pressed={selected}
                >
                  <span className="font-medium">{TEMPLATE_LABEL[id]}</span>
                  <span className="text-xs text-neutral-600">{TEMPLATE_DESCRIPTION[id]}</span>
                </button>
              );
            })}
          </div>
        </Tile>

        {template === "esrs-e1" && coverage.data ? (
          <CoverageWarning
            missing={coverage.data.counts.missing}
            partial={coverage.data.counts.partial}
          />
        ) : null}

        {template === "custom" ? (
          <Tile>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
              Título
            </h2>
            <p className="mt-1 text-sm text-neutral-700">Nome a aparecer na capa do PDF.</p>
            <div className="mt-4">
              <TextInput
                id="custom-title"
                labelText=""
                hideLabel
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder="Ex.: Resumo Energético 2025"
                maxLength={200}
              />
            </div>
          </Tile>
        ) : null}

        <Tile>
          <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
            Período
          </h2>
          <p className="mt-1 text-sm text-neutral-700">Intervalo coberto pelo relatório.</p>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2">
              <PeriodShortcut
                label="Ano corrente"
                onClick={() => {
                  const r = currentYearRange();
                  setPeriodStart(r.start);
                  setPeriodEnd(r.end);
                }}
              />
              <PeriodShortcut
                label="Ano anterior"
                onClick={() => {
                  const r = previousYearRange();
                  setPeriodStart(r.start);
                  setPeriodEnd(r.end);
                }}
              />
              <PeriodShortcut
                label="Trimestre corrente"
                onClick={() => {
                  const r = currentQuarterRange();
                  setPeriodStart(r.start);
                  setPeriodEnd(r.end);
                }}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                id="periodStart"
                labelText="Início"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                max={todayIso()}
              />
              <TextInput
                id="periodEnd"
                labelText="Fim"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                max={todayIso()}
              />
            </div>
            {periodInvalid ? (
              <InlineNotification
                kind="error"
                title="Período inválido"
                subtitle="O fim do período deve ser igual ou posterior ao início."
                lowContrast
                hideCloseButton
              />
            ) : null}
          </div>
        </Tile>

        {start.isError ? (
          <InlineNotification
            kind="error"
            title="Não foi possível iniciar"
            subtitle="A geração falhou. Tente novamente."
            lowContrast
            hideCloseButton
          />
        ) : null}

        <div className="flex justify-end">
          <Button type="submit" kind="primary" disabled={!canSubmit} renderIcon={Send}>
            {start.isPending ? "A iniciar…" : "Gerar relatório PDF"}
          </Button>
        </div>
      </Stack>
    </form>
  );
}

function PeriodShortcut({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-neutral-300 bg-white px-3 py-1 text-xs hover:bg-neutral-100"
    >
      {label}
    </button>
  );
}

function CoverageWarning({ missing, partial }: { missing: number; partial: number }) {
  if (missing === 0 && partial === 0) return null;
  return (
    <InlineNotification
      kind="warning"
      title="Cobertura incompleta"
      subtitle={`${missing > 0 ? `${missing} datapoint(s) em falta` : ""}${missing > 0 && partial > 0 ? ", " : ""}${partial > 0 ? `${partial} parcial(is)` : ""}. Pode gerar mesmo assim — as lacunas aparecem na capa do PDF.`}
      lowContrast
      hideCloseButton
    />
  );
}
