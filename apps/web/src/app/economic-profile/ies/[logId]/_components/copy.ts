// pt-PT copy + lookup tables for the extraction status surface. Not
// React components; co-located with the views that consume them.

import type { Confidence, IesExtractionLog, ProfileField } from "@/lib/economic-profile-types";

export const STATUS_COPY: Record<IesExtractionLog["status"], string> = {
  pending: "A iniciar…",
  extracting: "A extrair dados (pode demorar até 30 segundos)…",
  awaiting_user_confirmation: "Pronto para revisão",
  confirmed: "Perfil económico confirmado",
  cancelled: "Carregamento cancelado",
  failed_not_ies: "O documento não parece ser um IES",
  failed_extraction: "Falhou a extração",
  failed_validation: "Falhou a validação",
};

export const CONFIDENCE_TAG_TYPE: Record<Confidence, "green" | "warm-gray" | "red"> = {
  HIGH: "green",
  MEDIUM: "warm-gray",
  LOW: "red",
};

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  HIGH: "Alta",
  MEDIUM: "Média",
  LOW: "Baixa",
};

export const FIELD_LABELS: Record<ProfileField, string> = {
  year: "Ano de exercício",
  employees: "Colaboradores",
  turnover: "Volume de negócios (€)",
  ebitda: "EBITDA (€)",
  balanceSheetTotal: "Ativo total (€)",
  cae: "CAE",
};

export const NUMERIC_FIELDS: ProfileField[] = [
  "year",
  "employees",
  "turnover",
  "ebitda",
  "balanceSheetTotal",
];

const CONFIRM_ERROR_COPY: Record<string, string> = {
  no_year: "Indique o ano de exercício antes de confirmar.",
  log_not_found: "Esta extração já não existe.",
  wrong_status: "Esta extração já não pode ser confirmada.",
  no_extraction: "A extração ainda não terminou.",
  forbidden: "Não tem permissões para confirmar nesta organização.",
};

export function confirmErrorMessage(error: unknown): string {
  const code = error instanceof Error ? error.message : "request_failed";
  return CONFIRM_ERROR_COPY[code] ?? "Não foi possível guardar. Tente novamente.";
}
