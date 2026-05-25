// pt-PT message per InsufficientData reason. Closures so we can
// interpolate the structured context (cae3, dimensao label) without
// the call site doing it.

type InsufficientReason =
  | "no_aggregate_for_cae3_and_dimensao"
  | "no_aggregate_in_year_window"
  | "missing_cae"
  | "missing_dimensao";

export const REASON_COPY: Record<
  InsufficientReason,
  (cae3: string | null, dimensaoLabel: string | null) => string
> = {
  no_aggregate_in_year_window: (cae3, dimensaoLabel) =>
    `Dados setoriais insuficientes para CAE-3 = ${cae3 ?? "(em falta)"} em empresas ${dimensaoLabel ?? "(dimensão não confirmada)"}.`,
  no_aggregate_for_cae3_and_dimensao: (cae3, dimensaoLabel) =>
    `Dados setoriais insuficientes para CAE-3 = ${cae3 ?? "(em falta)"} em empresas ${dimensaoLabel ?? "(dimensão não confirmada)"}.`,
  missing_cae: () =>
    "É necessário um CAE no perfil económico para comparar com pares do setor.",
  missing_dimensao: () =>
    "É necessário confirmar a dimensão para comparar com pares do setor.",
};
