"use client";

// Polls the IES extraction log every 2s until terminal. The big states:
//
//   pending / extracting        → progress spinner
//   awaiting_user_confirmation  → editable result form + Confirm / Cancel
//   confirmed                   → success card + link to dashboard
//   failed_*                    → error banner with the pt-PT message
//   cancelled                   → cancellation card
//
// Confirm/Cancel are useMutations; on success they invalidate the
// per-log query so the UI snaps to the terminal state without an extra
// round-trip.

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelExtraction,
  confirmExtraction,
  getExtractionStatus,
} from "@/lib/economic-profile-actions";
import {
  type Confidence,
  type ExtractedEconomicProfile,
  type ExtractionEdits,
  type IesExtractionLog,
  type ProfileField,
  type ValidatorWarning,
  isTerminalStatus,
} from "@/lib/economic-profile-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_COPY: Record<IesExtractionLog["status"], string> = {
  pending: "A iniciar…",
  extracting: "A extrair dados (pode demorar até 30 segundos)…",
  awaiting_user_confirmation: "Pronto para revisão",
  confirmed: "Perfil económico confirmado",
  cancelled: "Carregamento cancelado",
  failed_not_ies: "O documento não parece ser um IES",
  failed_extraction: "Falhou a extração",
  failed_validation: "Falhou a validação",
};

const CONFIDENCE_VARIANT: Record<Confidence, "success" | "warning" | "destructive"> = {
  HIGH: "success",
  MEDIUM: "warning",
  LOW: "destructive",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};

const FIELD_LABELS: Record<ProfileField, string> = {
  year: "Ano de exercício",
  employees: "Colaboradores",
  turnover: "Volume de negócios (€)",
  ebitda: "EBITDA (€)",
  balanceSheetTotal: "Ativo total (€)",
  cae: "CAE",
};

const NUMERIC_FIELDS: ProfileField[] = [
  "year",
  "employees",
  "turnover",
  "ebitda",
  "balanceSheetTotal",
];

export function ExtractionStatusView({ logId }: { logId: string }) {
  const router = useRouter();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["ies-extraction", logId],
    queryFn: () => getExtractionStatus(logId),
    // Poll while not terminal. Returning false stops the poll loop.
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status && isTerminalStatus(status)) return false;
      return 2000;
    },
    refetchIntervalInBackground: true,
  });

  // Editable copy of the extracted values. Initialised when the
  // extraction lands (the effect inside the form below).
  const [edits, setEdits] = useState<ExtractionEdits>({});

  const confirm = useMutation({
    mutationFn: () => confirmExtraction(logId, edits),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ies-extraction", logId] });
      qc.invalidateQueries({ queryKey: ["economic-profiles"] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => cancelExtraction(logId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ies-extraction", logId] });
    },
  });

  if (query.isLoading) {
    return <p className="text-sm text-muted-foreground">A carregar estado…</p>;
  }
  if (query.isError || !query.data) {
    return (
      <Alert variant="destructive">
        Não foi possível obter o estado desta extração.{" "}
        <Link href="/economic-profile" className="underline">
          Voltar
        </Link>
      </Alert>
    );
  }

  const log = query.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{log.originalFilename ?? "IES"}</CardTitle>
        <CardDescription>{STATUS_COPY[log.status]}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {log.status === "pending" || log.status === "extracting" ? (
          <ProgressBlock />
        ) : null}

        {log.status === "awaiting_user_confirmation" && log.extractionResult ? (
          <ResultForm
            extraction={log.extractionResult}
            warnings={log.validatorWarnings ?? []}
            edits={edits}
            onChange={setEdits}
            onConfirm={() => confirm.mutate()}
            onCancel={() => cancel.mutate()}
            isConfirming={confirm.isPending}
            isCancelling={cancel.isPending}
            confirmError={confirm.isError ? confirmErrorMessage(confirm.error) : null}
          />
        ) : null}

        {log.status === "confirmed" ? (
          <ConfirmedBlock onContinue={() => router.push("/economic-profile")} />
        ) : null}

        {log.status === "cancelled" ? (
          <Alert variant="info">
            Carregamento cancelado. <Link href="/economic-profile" className="underline">Voltar ao perfil económico.</Link>
          </Alert>
        ) : null}

        {(log.status === "failed_not_ies" ||
          log.status === "failed_extraction" ||
          log.status === "failed_validation") &&
        log.errorMessage ? (
          <FailureBlock message={log.errorMessage} status={log.status} />
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProgressBlock() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-primary" />
      A processar o documento. Esta página atualiza automaticamente.
    </div>
  );
}

function ConfirmedBlock({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="space-y-3">
      <Alert variant="success">Perfil económico guardado com sucesso.</Alert>
      <Button onClick={onContinue}>Ver perfil económico</Button>
    </div>
  );
}

function FailureBlock({
  message,
  status,
}: {
  message: string;
  status: "failed_not_ies" | "failed_extraction" | "failed_validation";
}) {
  return (
    <div className="space-y-3">
      <Alert variant="destructive">{message}</Alert>
      <div className="flex gap-2">
        <Link href="/economic-profile/ies/new" className="text-sm underline">
          {status === "failed_not_ies" ? "Carregar outro documento" : "Tentar novamente"}
        </Link>
        <span className="text-sm text-muted-foreground">·</span>
        <Link href="/economic-profile/manual" className="text-sm underline">
          Entrada manual
        </Link>
      </div>
    </div>
  );
}

function ResultForm({
  extraction,
  warnings,
  edits,
  onChange,
  onConfirm,
  onCancel,
  isConfirming,
  isCancelling,
  confirmError,
}: {
  extraction: ExtractedEconomicProfile;
  warnings: ValidatorWarning[];
  edits: ExtractionEdits;
  onChange: (next: ExtractionEdits) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isConfirming: boolean;
  isCancelling: boolean;
  confirmError: string | null;
}) {
  const warningsByField = new Map<ProfileField | "_global", ValidatorWarning[]>();
  for (const w of warnings) {
    const key = w.field ?? "_global";
    const list = warningsByField.get(key) ?? [];
    list.push(w);
    warningsByField.set(key, list);
  }

  function setField<K extends ProfileField>(
    field: K,
    value: ExtractionEdits[K] | undefined,
  ): void {
    const next = { ...edits };
    if (value === undefined) delete next[field];
    else next[field] = value;
    onChange(next);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Reveja os valores extraídos. Cada campo mostra a confiança da IA — pode editar antes de
        confirmar.
      </p>
      <div className="grid gap-4">
        {(["year", "employees", "turnover", "ebitda", "balanceSheetTotal", "cae"] as ProfileField[]).map(
          (field) => (
            <FieldRow
              key={field}
              field={field}
              extracted={extraction[field]}
              edit={edits[field]}
              isNumeric={NUMERIC_FIELDS.includes(field)}
              warnings={warningsByField.get(field) ?? []}
              onChange={(v) => setField(field, v as ExtractionEdits[typeof field])}
            />
          ),
        )}
      </div>
      {confirmError ? <Alert variant="destructive">{confirmError}</Alert> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={onConfirm} disabled={isConfirming || isCancelling}>
          {isConfirming ? "A guardar…" : "Confirmar e guardar"}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={isConfirming || isCancelling}>
          {isCancelling ? "A cancelar…" : "Cancelar"}
        </Button>
      </div>
    </div>
  );
}

function FieldRow({
  field,
  extracted,
  edit,
  isNumeric,
  warnings,
  onChange,
}: {
  field: ProfileField;
  extracted: ExtractedEconomicProfile[ProfileField];
  edit: number | string | null | undefined;
  isNumeric: boolean;
  warnings: ValidatorWarning[];
  onChange: (value: number | string | null | undefined) => void;
}) {
  const id = `field-${field}`;
  // Display value: edit if present (even if null), otherwise the
  // extracted value. Null → empty string in the input.
  const effective = edit !== undefined ? edit : extracted.value;
  const inputValue = effective === null || effective === undefined ? "" : String(effective);

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center gap-2">
        <Label htmlFor={id}>{FIELD_LABELS[field]}</Label>
        <Badge variant={CONFIDENCE_VARIANT[extracted.confidence]}>
          {CONFIDENCE_LABEL[extracted.confidence]}
        </Badge>
      </div>
      <Input
        id={id}
        type={isNumeric ? "number" : "text"}
        value={inputValue}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === "") {
            onChange(null);
            return;
          }
          if (isNumeric) {
            const n = Number(raw);
            onChange(Number.isFinite(n) ? n : undefined);
          } else {
            onChange(raw);
          }
        }}
      />
      {warnings.length > 0 ? (
        <ul className="text-xs text-amber-700">
          {warnings.map((w) => (
            <li key={w.rule}>⚠︎ {w.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

const CONFIRM_ERROR_COPY: Record<string, string> = {
  no_year: "Indique o ano de exercício antes de confirmar.",
  log_not_found: "Esta extração já não existe.",
  wrong_status: "Esta extração já não pode ser confirmada.",
  no_extraction: "A extração ainda não terminou.",
  forbidden: "Não tem permissões para confirmar nesta organização.",
};

function confirmErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "request_failed";
  return CONFIRM_ERROR_COPY[code] ?? "Não foi possível guardar. Tente novamente.";
}
