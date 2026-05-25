// V10.1 — GHG Protocol Corporate Standard datapoint subset.
//
// Covers the Scope 1, Scope 2 location/market split, and the most
// commonly reported Scope 3 categories (1, 4, 5, 6, 7). The remaining
// Scope 3 categories (2 capital goods, 3 fuel/energy related, 8-15)
// are out of scope for v1 — PT mid-caps rarely have the value-chain
// data depth to compute them.

import type { FrameworkDatapoint } from "./types.js";

const VERSION = "ghgp-2015";

function dp(
  code: string,
  topic: string,
  title: string,
  description: string,
): FrameworkDatapoint {
  return {
    // Same id pattern as ESRS for grep-friendliness — "ghg-scope1",
    // "ghg-scope3-cat1", etc.
    id: `ghg-${code.toLowerCase().replace(/\s+/g, "-")}`,
    framework: "ghg",
    topic,
    code,
    title,
    description,
    sectorApplicability: { kind: "all" },
    version: VERSION,
  };
}

export const GHG_PROTOCOL_DATAPOINTS: readonly FrameworkDatapoint[] = [
  // Scope 1 (direct emissions)
  dp(
    "Scope1-Total",
    "Scope 1",
    "Emissões diretas — Âmbito 1 (total)",
    "Soma de emissões de combustão estacionária, móvel, processos industriais e fugitivas controladas pela empresa.",
  ),
  dp(
    "Scope1-Stationary",
    "Scope 1",
    "Âmbito 1 — Combustão estacionária",
    "Emissões da combustão de combustíveis em equipamentos fixos (caldeiras, geradores, fornos).",
  ),
  dp(
    "Scope1-Mobile",
    "Scope 1",
    "Âmbito 1 — Combustão móvel",
    "Emissões da combustão em frotas próprias (veículos, máquinas).",
  ),
  dp(
    "Scope1-Process",
    "Scope 1",
    "Âmbito 1 — Emissões de processo",
    "Emissões de processos industriais não relacionados com combustão (ex.: descarbonatação na produção de cimento).",
  ),
  dp(
    "Scope1-Fugitive",
    "Scope 1",
    "Âmbito 1 — Emissões fugitivas",
    "Fugas de gases refrigerantes (HFCs), metano e outros gases não capturados de forma intencional.",
  ),

  // Scope 2 (indirect — purchased energy)
  dp(
    "Scope2-Location",
    "Scope 2",
    "Âmbito 2 — Eletricidade (location-based)",
    "Emissões de eletricidade adquirida calculadas pelo fator de emissão médio da rede nacional.",
  ),
  dp(
    "Scope2-Market",
    "Scope 2",
    "Âmbito 2 — Eletricidade (market-based)",
    "Emissões de eletricidade adquirida calculadas com base em contratos específicos (PPAs, garantias de origem).",
  ),
  dp(
    "Scope2-Heat",
    "Scope 2",
    "Âmbito 2 — Calor / vapor adquirido",
    "Emissões associadas a calor ou vapor adquiridos a um fornecedor externo.",
  ),

  // Scope 3 (subset of 15 categories — the ones PT mid-caps actually report)
  dp(
    "Scope3-Cat1",
    "Scope 3",
    "Âmbito 3 — Cat. 1: Bens e serviços adquiridos",
    "Emissões incorporadas nos bens e serviços comprados pela empresa durante o período.",
  ),
  dp(
    "Scope3-Cat4",
    "Scope 3",
    "Âmbito 3 — Cat. 4: Transporte e distribuição a montante",
    "Emissões do transporte e distribuição de bens adquiridos, entre fornecedores e instalações próprias.",
  ),
  dp(
    "Scope3-Cat5",
    "Scope 3",
    "Âmbito 3 — Cat. 5: Resíduos gerados",
    "Emissões da gestão de resíduos gerados pelas operações (aterro, incineração, reciclagem).",
  ),
  dp(
    "Scope3-Cat6",
    "Scope 3",
    "Âmbito 3 — Cat. 6: Deslocações em serviço",
    "Emissões de viagens de negócios em transporte aéreo, ferroviário, rodoviário, alojamento.",
  ),
  dp(
    "Scope3-Cat7",
    "Scope 3",
    "Âmbito 3 — Cat. 7: Deslocações casa-trabalho",
    "Emissões das deslocações regulares dos colaboradores para o local de trabalho.",
  ),
  dp(
    "Scope3-Cat9",
    "Scope 3",
    "Âmbito 3 — Cat. 9: Transporte a jusante",
    "Emissões da distribuição de produtos vendidos, entre instalações da empresa e clientes.",
  ),
  dp(
    "Scope3-Cat11",
    "Scope 3",
    "Âmbito 3 — Cat. 11: Uso dos produtos vendidos",
    "Emissões da utilização pelos clientes dos produtos vendidos (energia consumida pelos produtos no ciclo de vida).",
  ),
];
