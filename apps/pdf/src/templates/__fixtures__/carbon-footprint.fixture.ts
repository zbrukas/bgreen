// Rich sample payload for the carbon-footprint deck. Numbers mirror a
// real PT carbon-footprint report (Grupo Parapedra, GHG Protocol,
// Âmbitos 1 + 2) so the rendered deck looks authentic during visual
// verification. Used by the dev render-fixture script and the registry
// test. NOT shipped to production — apps/api builds the live payload.

import type { CarbonFootprintData } from "../types.js";

export const carbonFootprintFixture: CarbonFootprintData = {
  period: { start: "2023-01-01", end: "2023-12-31" },
  footer: {
    generatedAt: "2026-06-02T10:30:00.000Z",
    inputDataHash:
      "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
  },
  title: "Pegada de Carbono 2023",
  subtitle: "Inventário de emissões GEE — Âmbitos 1 e 2 (GHG Protocol)",
  unitLabel: "tCO₂e",
  totalTco2e: 23176.5,
  scopes: [
    { scope: "1", label: "Emissões diretas", tco2e: 17706.0 },
    { scope: "2", label: "Energia adquirida (localização)", tco2e: 5470.5 },
  ],
  sources: [
    { scope: "1", category: "Combustão estacionária", source: "Fornos e caldeiras GN", tco2e: 13508.7 },
    { scope: "1", category: "Combustão estacionária", source: "Fornos e caldeiras GPL", tco2e: 983.6 },
    { scope: "1", category: "Combustão móvel", source: "Maquinaria industrial", tco2e: 2603.4 },
    { scope: "1", category: "Combustão móvel", source: "Frota automóvel", tco2e: 608.8 },
    { scope: "1", category: "Emissões fugitivas", source: "Ar condicionado", tco2e: 1.45 },
    { scope: "1", category: "Emissões fugitivas", source: "Armazenamento de gases", tco2e: 0.02 },
    { scope: "2", category: "Eletricidade adquirida", source: "Abordagem baseada na localização", tco2e: 5470.5 },
  ],
  kpis: [
    { label: "Âmbito 1", value: 17706.0, unit: "tCO₂e", deltaPct: 3.2 },
    { label: "Âmbito 2 (localização)", value: 5470.5, unit: "tCO₂e", deltaPct: -4.1 },
    { label: "Combustão estacionária", value: 14492.3, unit: "tCO₂e", deltaPct: null },
  ],
  intensity: [
    { label: "Intensidade por produção", value: 1.4, unit: "tCO₂e / t produto" },
    { label: "Intensidade por volume de negócios", value: 38.6, unit: "tCO₂e / M€" },
  ],
  trend: {
    periods: ["2021", "2022", "2023"],
    unit: "tCO₂e",
    style: "stacked-bar",
    series: [
      { key: "s1", label: "Âmbito 1", values: [16120, 17030, 17706] },
      { key: "s2", label: "Âmbito 2 (localização)", values: [6210, 5890, 5470.5] },
    ],
  },
  factors: [
    { source: "Combustão de gás natural", factor: "2,43", unit: "kgCO₂eq/m³", reference: "Despacho n.º 17313/2008" },
    { source: "Combustão de GPL", factor: "2.939", unit: "kgCO₂eq/t", reference: "Despacho n.º 17313/2008" },
    { source: "Gasóleo — maquinaria industrial", factor: "2,50", unit: "kgCO₂eq/l", reference: "Faturas de gasóleo" },
    { source: "Gasóleo — veículos ligeiros", factor: "0,20", unit: "kgCO₂eq/km", reference: "INERPA — NIR 2024" },
    { source: "Gasóleo — veículos pesados", factor: "0,57", unit: "kgCO₂eq/km", reference: "INERPA — NIR 2024" },
    { source: "Eletricidade (localização)", factor: "0,157", unit: "kgCO₂eq/kWh", reference: "APA" },
    { source: "Eletricidade (mercado)", factor: "0", unit: "kgCO₂eq/kWh", reference: "Faturas (origem renovável)" },
  ],
  methodologyNotes: [
    "O cálculo seguiu as diretrizes do GHG Protocol e do IPCC (PAG-100, 6th Assessment Report).",
    "Foram contabilizadas apenas as emissões enquadradas nos Âmbitos 1 e 2.",
    "Na ausência de dados da frota, assumiram-se 100.000 km/ano (ligeiros) e 500.000 km/ano (pesados) a gasóleo.",
    "No Âmbito 2, a abordagem baseada no mercado resulta em 0 tCO₂e (eletricidade de origem renovável).",
  ],
  commentary: {
    sections: [
      {
        title: "Síntese",
        narrative:
          "As emissões totais do grupo em 2023 foram de 23.176,5 tCO₂e (abordagem de localização).",
        callouts: [
          "A combustão estacionária representa ~70% das emissões de Âmbito 1.",
          "Com a abordagem de mercado, o Âmbito 2 anula-se (eletricidade renovável).",
          "As emissões fugitivas são residuais no total da pegada.",
        ],
      },
    ],
  },
};
