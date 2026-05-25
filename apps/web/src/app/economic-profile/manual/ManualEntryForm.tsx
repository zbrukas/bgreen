"use client";

import { manualEntry } from "@/lib/economic-profile-actions";
import type { ManualEntryInput } from "@/lib/economic-profile-types";
import { Save } from "@carbon/icons-react";
import { Button, InlineNotification, Stack, TextInput, Tile } from "@carbon/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const CURRENT_YEAR = new Date().getUTCFullYear();

const ERROR_COPY: Record<string, string> = {
  invalid_year: "Ano fora do intervalo aceite (1990–2100).",
  forbidden: "Não tem permissões para guardar nesta organização.",
  no_active_org: "Selecione uma organização antes de continuar.",
};

function errorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "request_failed";
  return ERROR_COPY[code] ?? "Não foi possível guardar. Verifique os valores e tente novamente.";
}

function parseMoney(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function ManualEntryForm() {
  const router = useRouter();
  const [year, setYear] = useState<number>(CURRENT_YEAR - 1);
  const [employees, setEmployees] = useState<string>("");
  const [turnover, setTurnover] = useState<string>("");
  const [ebitda, setEbitda] = useState<string>("");
  const [balanceSheetTotal, setBalanceSheetTotal] = useState<string>("");
  const [cae, setCae] = useState<string>("");

  const mutation = useMutation({
    mutationFn: (input: ManualEntryInput) => manualEntry(input),
    onSuccess: () => {
      router.push("/economic-profile");
    },
  });

  function submit(): void {
    mutation.mutate({
      year,
      employees: employees.trim() === "" ? null : Number(employees),
      turnover: parseMoney(turnover),
      ebitda: parseMoney(ebitda),
      balanceSheetTotal: parseMoney(balanceSheetTotal),
      cae: cae.trim() === "" ? null : cae.trim(),
    });
  }

  return (
    <Tile>
      <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
        Entrada manual
      </h2>
      <p className="mt-1 text-sm text-neutral-700">
        Introduza os valores diretamente. Pode preencher só os campos que tem em mão — não obriga
        os restantes.
      </p>
      <div className="mt-4">
        <Stack gap={5}>
          <TextInput
            id="year"
            labelText="Ano de exercício"
            type="number"
            min={1990}
            max={CURRENT_YEAR + 1}
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput
              id="employees"
              labelText="Colaboradores"
              type="number"
              min={0}
              value={employees}
              onChange={(e) => setEmployees(e.target.value)}
              placeholder="—"
            />
            <TextInput
              id="cae"
              labelText="CAE"
              type="text"
              value={cae}
              onChange={(e) => setCae(e.target.value)}
              placeholder="ex. 62010"
              maxLength={64}
            />
            <TextInput
              id="turnover"
              labelText="Volume de negócios (€)"
              type="number"
              min={0}
              value={turnover}
              onChange={(e) => setTurnover(e.target.value)}
              placeholder="—"
            />
            <TextInput
              id="ebitda"
              labelText="EBITDA (€)"
              type="number"
              value={ebitda}
              onChange={(e) => setEbitda(e.target.value)}
              placeholder="—"
            />
            <div className="sm:col-span-2">
              <TextInput
                id="balanceSheetTotal"
                labelText="Ativo total (€)"
                type="number"
                min={0}
                value={balanceSheetTotal}
                onChange={(e) => setBalanceSheetTotal(e.target.value)}
                placeholder="—"
              />
            </div>
          </div>

          {mutation.isError ? (
            <InlineNotification
              kind="error"
              title="Não foi possível guardar"
              subtitle={errorMessage(mutation.error)}
              lowContrast
              hideCloseButton
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-3">
            <Button
              kind="primary"
              onClick={submit}
              disabled={mutation.isPending}
              renderIcon={Save}
            >
              {mutation.isPending ? "A guardar…" : "Guardar"}
            </Button>
            <Link
              href="/economic-profile"
              className="text-sm text-[var(--cds-link-primary)] hover:underline"
            >
              Voltar
            </Link>
          </div>
        </Stack>
      </div>
    </Tile>
  );
}
