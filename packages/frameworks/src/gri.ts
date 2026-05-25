// V10.1 — GRI Universal + Topic Standards subset (2021 revision).
//
// Picks the disclosures PT mid-caps encounter first when reporting to
// supply-chain customers or stakeholders: governance basics (GRI 2),
// energy (302), water (303), emissions (305), waste (306), employees
// (401-405). v1 doesn't cover biodiversity (304), local communities
// (413), tax (207), or anti-corruption (205) — those land in v1.5.

import type { FrameworkDatapoint } from "./types.js";

const VERSION = "gri-2021";

function dp(
  code: string,
  topic: string,
  title: string,
  description: string,
): FrameworkDatapoint {
  return {
    id: `gri-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    framework: "gri",
    topic,
    code,
    title,
    description,
    sectorApplicability: { kind: "all" },
    version: VERSION,
  };
}

export const GRI_DATAPOINTS: readonly FrameworkDatapoint[] = [
  // GRI 2: General Disclosures
  dp(
    "2-1",
    "GRI 2",
    "Detalhes organizacionais",
    "Nome legal, sede, forma jurídica, países de operação.",
  ),
  dp(
    "2-7",
    "GRI 2",
    "Empregados",
    "Número total de colaboradores por tipo de contrato, género e região.",
  ),
  dp(
    "2-22",
    "GRI 2",
    "Declaração sobre estratégia de desenvolvimento sustentável",
    "Declaração do órgão de governo mais alto sobre a estratégia de sustentabilidade.",
  ),
  dp(
    "2-23",
    "GRI 2",
    "Compromissos políticos",
    "Compromissos com princípios de conduta empresarial responsável (ex.: Pacto Global da ONU).",
  ),
  dp(
    "2-29",
    "GRI 2",
    "Abordagem ao envolvimento de partes interessadas",
    "Processo de identificação e envolvimento das partes interessadas.",
  ),

  // GRI 302: Energy
  dp(
    "302-1",
    "GRI 302",
    "Consumo de energia dentro da organização",
    "Consumo de combustíveis, eletricidade, calor, vapor e arrefecimento dentro das operações.",
  ),
  dp(
    "302-3",
    "GRI 302",
    "Intensidade energética",
    "Consumo de energia por unidade da métrica organizacional (receita, FTE, produção).",
  ),
  dp(
    "302-4",
    "GRI 302",
    "Redução do consumo de energia",
    "Reduções de consumo energético resultantes de iniciativas de eficiência.",
  ),

  // GRI 303: Water and Effluents
  dp(
    "303-3",
    "GRI 303",
    "Captação de água",
    "Volume total de água captada, desagregado por fonte (superficial, subterrânea, terceiros).",
  ),
  dp(
    "303-5",
    "GRI 303",
    "Consumo de água",
    "Volume total de água consumida nas operações.",
  ),

  // GRI 305: Emissions
  dp(
    "305-1",
    "GRI 305",
    "Emissões diretas de GEE (Âmbito 1)",
    "Emissões brutas diretas de gases com efeito de estufa em tCO2e.",
  ),
  dp(
    "305-2",
    "GRI 305",
    "Emissões indiretas de GEE da energia adquirida (Âmbito 2)",
    "Emissões indiretas associadas a eletricidade, calor, vapor adquiridos.",
  ),
  dp(
    "305-3",
    "GRI 305",
    "Outras emissões indiretas de GEE (Âmbito 3)",
    "Emissões indiretas a montante e a jusante da cadeia de valor.",
  ),
  dp(
    "305-4",
    "GRI 305",
    "Intensidade de emissões de GEE",
    "Emissões totais por unidade da métrica organizacional.",
  ),
  dp(
    "305-7",
    "GRI 305",
    "Emissões atmosféricas (NOx, SOx, partículas)",
    "Outras emissões atmosféricas significativas: NOx, SOx, COV, partículas.",
  ),

  // GRI 306: Waste
  dp(
    "306-3",
    "GRI 306",
    "Resíduos gerados",
    "Quantidade total de resíduos gerados, desagregada por tipo (perigosos, não perigosos).",
  ),
  dp(
    "306-4",
    "GRI 306",
    "Resíduos desviados de aterro",
    "Quantidade de resíduos preparados para reutilização, reciclagem ou valorização.",
  ),

  // GRI 401: Employment
  dp(
    "401-1",
    "GRI 401",
    "Novas contratações e rotatividade",
    "Taxas de novas contratações e rotatividade por género e faixa etária.",
  ),

  // GRI 403: Occupational Health and Safety
  dp(
    "403-9",
    "GRI 403",
    "Lesões relacionadas com o trabalho",
    "Taxa de lesões registáveis, lesões com perda de dias, fatalidades.",
  ),

  // GRI 405: Diversity and Equal Opportunity
  dp(
    "405-1",
    "GRI 405",
    "Diversidade nos órgãos de governo e colaboradores",
    "Composição dos órgãos de governo e categorias profissionais por género e idade.",
  ),
];
