// V10.1 — ESRS E1 (Climate change) datapoint subset.
//
// Covers the ~30 datapoints we expect PT mid-caps to encounter first:
// transition plan + targets + actions + metrics (Scopes 1/2/3 +
// intensity) + policies. Excluded from v1: financial effects (E1-7,
// E1-8, E1-9 in part) which need quant data most mid-caps don't have
// yet; carbon credits and CCUS line items.
//
// Energy-intensive CAE-3 list comes from the EU ETS scope: power,
// metals, minerals, chemicals, refineries. The list is intentionally
// conservative — the UI filter lets users hide non-applicable rows;
// over-inclusion is preferable to silent omission.

import type { FrameworkDatapoint } from "./types.js";

const VERSION = "esrs-2024";

// EU ETS-scoped industrial sectors at CAE-3 granularity. Power, gas,
// metals, minerals, chemicals, oil & gas refining.
const ENERGY_INTENSIVE_CAE3: readonly string[] = [
  "191", // Coke ovens
  "192", // Petroleum refining
  "201", // Basic chemicals
  "231", // Glass
  "232", // Refractory products
  "233", // Clay building materials
  "234", // Porcelain and ceramic products
  "235", // Cement, lime and plaster
  "241", // Basic iron and steel
  "242", // Tubes and pipes (iron/steel)
  "243", // Other first-processing iron/steel
  "244", // Basic precious + non-ferrous metals
  "245", // Casting of metals
  "351", // Electricity
  "352", // Gas distribution
  "353", // Steam and air-conditioning supply
  "381", // Waste collection
  "382", // Waste treatment
] as const;

function dp(
  code: string,
  title: string,
  description: string,
  scope: "all" | "energy-intensive",
): FrameworkDatapoint {
  return {
    id: `esrs-${code.toLowerCase()}`,
    framework: "esrs",
    topic: "E1",
    code,
    title,
    description,
    sectorApplicability:
      scope === "all"
        ? { kind: "all" }
        : { kind: "cae3-list", values: ENERGY_INTENSIVE_CAE3 },
    version: VERSION,
  };
}

export const ESRS_E1_DATAPOINTS: readonly FrameworkDatapoint[] = [
  // Governance / strategy
  dp(
    "E1-1",
    "Plano de transição para mitigação das alterações climáticas",
    "Descrição do plano da empresa para alinhar o seu modelo de negócio com a limitação do aquecimento global a 1,5 °C, incluindo metas e investimentos.",
    "all",
  ),
  dp(
    "E1-2",
    "Políticas relacionadas com a mitigação e a adaptação",
    "Políticas que regem as ações de mitigação (redução de emissões) e adaptação (resiliência) climática.",
    "all",
  ),
  dp(
    "E1-3",
    "Ações e recursos relacionados com políticas climáticas",
    "Ações concretas implementadas e recursos financeiros + humanos alocados às políticas climáticas no período.",
    "all",
  ),

  // Targets
  dp(
    "E1-4-target-absolute",
    "Meta absoluta de redução de emissões GEE",
    "Meta quantificada de redução absoluta de emissões de gases com efeito de estufa, com ano-base e horizonte (curto/médio/longo prazo).",
    "all",
  ),
  dp(
    "E1-4-target-intensity",
    "Meta de redução de intensidade de emissões",
    "Meta de redução da intensidade de emissões por unidade de produção, receita ou outra métrica relevante.",
    "all",
  ),
  dp(
    "E1-4-target-renewable",
    "Meta de aumento de consumo de energia renovável",
    "Meta de aumento da quota de energia renovável no consumo total, com horizonte temporal.",
    "all",
  ),

  // Energy (E1-5)
  dp(
    "E1-5-energy-total",
    "Consumo total de energia",
    "Consumo total de energia em MWh, desagregado por fonte (combustível fóssil, nuclear, renovável).",
    "all",
  ),
  dp(
    "E1-5-energy-renewable-share",
    "Quota de energia renovável",
    "Percentagem do consumo total de energia proveniente de fontes renováveis.",
    "all",
  ),
  dp(
    "E1-5-energy-intensity",
    "Intensidade energética por receita",
    "Consumo de energia (MWh) dividido pela receita líquida (€ milhões). Aplicável a setores energo-intensivos.",
    "energy-intensive",
  ),
  dp(
    "E1-5-energy-production",
    "Produção de energia não-renovável",
    "Energia produzida internamente a partir de combustíveis fósseis ou nuclear, em MWh.",
    "energy-intensive",
  ),

  // Scope 1 (E1-6)
  dp(
    "E1-6-scope1-gross",
    "Emissões brutas de GEE — Âmbito 1",
    "Emissões diretas de gases com efeito de estufa em tCO2e: combustão estacionária, móvel, processos industriais, fugitivas.",
    "all",
  ),
  dp(
    "E1-6-scope1-biogenic",
    "Emissões biogénicas — Âmbito 1",
    "Emissões biogénicas (combustão de biomassa) reportadas separadamente em tCO2.",
    "all",
  ),
  dp(
    "E1-6-scope1-regulated",
    "Emissões regulamentadas — Âmbito 1",
    "Quota das emissões de Âmbito 1 cobertas por mecanismos de comércio de emissões (CELE/EU ETS).",
    "energy-intensive",
  ),

  // Scope 2 (E1-6)
  dp(
    "E1-6-scope2-location",
    "Emissões — Âmbito 2 (location-based)",
    "Emissões indiretas associadas a eletricidade, calor, vapor adquiridos, calculadas pela média da rede.",
    "all",
  ),
  dp(
    "E1-6-scope2-market",
    "Emissões — Âmbito 2 (market-based)",
    "Emissões indiretas associadas a contratos específicos de eletricidade verde, PPAs, garantias de origem.",
    "all",
  ),

  // Scope 3 (E1-6)
  dp(
    "E1-6-scope3-total",
    "Emissões totais — Âmbito 3",
    "Emissões indiretas a montante e a jusante da cadeia de valor (15 categorias do GHG Protocol).",
    "all",
  ),
  dp(
    "E1-6-scope3-purchased-goods",
    "Âmbito 3 — Bens e serviços adquiridos",
    "Categoria 1 do Âmbito 3: emissões incorporadas nos bens e serviços adquiridos.",
    "all",
  ),
  dp(
    "E1-6-scope3-business-travel",
    "Âmbito 3 — Deslocações em serviço",
    "Categoria 6 do Âmbito 3: deslocações dos colaboradores em transporte aéreo, ferroviário, rodoviário.",
    "all",
  ),
  dp(
    "E1-6-scope3-commuting",
    "Âmbito 3 — Deslocações casa-trabalho",
    "Categoria 7 do Âmbito 3: deslocações regulares dos colaboradores para o local de trabalho.",
    "all",
  ),
  dp(
    "E1-6-scope3-upstream-transport",
    "Âmbito 3 — Transporte e distribuição a montante",
    "Categoria 4 do Âmbito 3: transporte e distribuição de bens adquiridos.",
    "all",
  ),
  dp(
    "E1-6-scope3-waste",
    "Âmbito 3 — Resíduos gerados",
    "Categoria 5 do Âmbito 3: resíduos gerados nas operações.",
    "all",
  ),

  // Intensity
  dp(
    "E1-6-intensity-revenue",
    "Intensidade de emissões por receita",
    "Emissões totais (Âmbitos 1+2) divididas pela receita líquida (tCO2e / € milhões).",
    "all",
  ),
  dp(
    "E1-6-intensity-fte",
    "Intensidade de emissões por colaborador (FTE)",
    "Emissões totais (Âmbitos 1+2) divididas pelo número de colaboradores equivalentes a tempo inteiro.",
    "all",
  ),

  // Risk / IROs
  dp(
    "E1-IRO-physical",
    "Riscos físicos identificados",
    "Riscos físicos materializados ou esperados das alterações climáticas (eventos extremos, stress hídrico, sobreaquecimento).",
    "all",
  ),
  dp(
    "E1-IRO-transition",
    "Riscos de transição identificados",
    "Riscos de transição: políticas climáticas, mercado, tecnologia, reputação.",
    "all",
  ),
  dp(
    "E1-IRO-opportunities",
    "Oportunidades climáticas identificadas",
    "Oportunidades de mercado, produtos, eficiência decorrentes da transição climática.",
    "all",
  ),

  // Carbon pricing
  dp(
    "E1-internal-carbon-price",
    "Preço interno do carbono",
    "Preço interno do carbono utilizado nas decisões de investimento, expresso em €/tCO2e.",
    "all",
  ),

  // Climate-related financial effects (subset for v1)
  dp(
    "E1-7-removals-projects",
    "Projetos de remoção de GEE",
    "Projetos de remoção de carbono (florestação, captura de CO2, soluções baseadas na natureza).",
    "all",
  ),
  dp(
    "E1-7-carbon-credits",
    "Créditos de carbono utilizados",
    "Créditos de carbono adquiridos ou retirados em nome da empresa para compensar emissões residuais.",
    "all",
  ),
  dp(
    "E1-anticipated-financial-effects",
    "Efeitos financeiros antecipados de riscos climáticos",
    "Quantificação preliminar dos efeitos financeiros esperados dos riscos físicos e de transição identificados.",
    "all",
  ),
];
