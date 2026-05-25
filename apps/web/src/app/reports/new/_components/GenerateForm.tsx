"use client";

// V11.4 — "Gerar relatório PDF" form.
//
// Three controls:
//   - Template picker (radio): ghg-inventory | esrs-e1 | custom.
//   - Period selector: start + end ISO dates with shortcut buttons
//     (current year / previous year / current quarter).
//   - Custom title (only for the custom template).
//
// When the user picks ESRS E1 we fetch the V10 coverage matrix
// (deterministic, fast) and surface a pt-PT warning if there are
// missing datapoints (V11 plan §UI:
// "Atenção: N datapoints obrigatórios estão em falta — gerar mesmo
// assim?"). The user can still proceed.
//
// Submit → POST /reports → 202 → routes to /reports/[id].

import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { getCoverageMatrix } from "@/lib/coverage-actions";
import { startReport } from "@/lib/reports-actions";
import {
  TEMPLATE_LABEL,
  type ReportTemplateId,
} from "@/lib/reports-types";
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
  const q = Math.floor(now.getUTCMonth() / 3); // 0..3
  const startMonth = q * 3 + 1;
  const endMonth = startMonth + 2;
  // 31-day cap; the API only needs valid yyyy-mm-dd within the
  // calendar — pick the last day of the end month.
  const lastDayByMonth: Record<number, number> = {
    1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30, 7: 31, 8: 31, 9: 30,
    10: 31, 11: 30, 12: 31,
  };
  // Leap-year guard for Q1: Feb 29 if applicable.
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

  // ESRS E1 coverage warning. Fetched only when the user actually
  // selects that template — the matrix call is cheap but no point
  // doing it for the other two.
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
      className="space-y-6"
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Modelo</CardTitle>
          <CardDescription>
            Escolha o tipo de relatório a gerar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {TEMPLATES.map((id) => {
            const selected = template === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTemplate(id)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-input hover:bg-accent hover:text-accent-foreground",
                )}
                aria-pressed={selected}
              >
                <span className="font-medium">{TEMPLATE_LABEL[id]}</span>
                <span className="text-xs text-muted-foreground">
                  {TEMPLATE_DESCRIPTION[id]}
                </span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      {template === "esrs-e1" && coverage.data ? (
        <CoverageWarning
          missing={coverage.data.counts.missing}
          partial={coverage.data.counts.partial}
        />
      ) : null}

      {template === "custom" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Título</CardTitle>
            <CardDescription>
              Nome a aparecer na capa do PDF.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Input
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Ex.: Resumo Energético 2025"
              maxLength={200}
            />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período</CardTitle>
          <CardDescription>Intervalo coberto pelo relatório.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
            <div className="space-y-1">
              <Label htmlFor="periodStart">Início</Label>
              <Input
                id="periodStart"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                max={todayIso()}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="periodEnd">Fim</Label>
              <Input
                id="periodEnd"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                max={todayIso()}
              />
            </div>
          </div>
          {periodInvalid ? (
            <Alert variant="destructive">
              O fim do período deve ser igual ou posterior ao início.
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {start.isError ? (
        <Alert variant="destructive">
          Não foi possível iniciar a geração. Tente novamente.
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!canSubmit}>
          {start.isPending ? "A iniciar…" : "Gerar relatório PDF"}
        </Button>
      </div>
    </form>
  );
}

function PeriodShortcut({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-input bg-background px-3 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
    >
      {label}
    </button>
  );
}

function CoverageWarning({
  missing,
  partial,
}: {
  missing: number;
  partial: number;
}) {
  if (missing === 0 && partial === 0) return null;
  return (
    <Alert variant="warning">
      <strong>Cobertura incompleta:</strong>{" "}
      {missing > 0 ? `${missing} datapoint(s) em falta` : null}
      {missing > 0 && partial > 0 ? ", " : ""}
      {partial > 0 ? `${partial} parcial(is)` : null}
      . Pode gerar mesmo assim — as lacunas aparecem na capa do PDF.
    </Alert>
  );
}
