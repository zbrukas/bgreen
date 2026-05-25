// Seed `sector_aggregates` with placeholder rows for the V7.2 demo path.
// Idempotent: upserts on (cae3, dimensao, year, fonte). Re-running
// overwrites placeholder values; switching `fonte` to a real
// 'bdp_quadros_2024' string later won't conflict with these rows.
//
// Numbers are plausible PT-economy intuitions, NOT real benchmarks.
// The UI surfaces fonte='placeholder_v1' in the vintage badge so any
// user can see the data isn't authoritative.
//
// Run via: pnpm --filter @bgreen/api seed-sector-aggregates

import "../src/setup.js";

import { db, pool, schema } from "@bgreen/db";
import { sql } from "drizzle-orm";

type Dimensao = "micro" | "pequena" | "media" | "grande";

interface SectorProfile {
  cae3: string;
  name: string;
  // (turnover, ebitdaMargin) per dimensao band.
  // Turnover in EUR. EBITDA margin as a ratio (0.15 = 15%).
  bands: Record<Dimensao, { turnover: number; ebitdaMargin: number }>;
}

// 10 CAE-3 sectors covering ESG-relevant Portuguese verticals. Numbers
// scaled by EU 2003/361/EC band: each band's median turnover sits
// comfortably inside the band's regulatory ceiling.
const SECTORS: SectorProfile[] = [
  {
    cae3: "351",
    name: "Eletricidade, gás, vapor",
    bands: {
      micro: { turnover: 800_000, ebitdaMargin: 0.18 },
      pequena: { turnover: 6_500_000, ebitdaMargin: 0.20 },
      media: { turnover: 35_000_000, ebitdaMargin: 0.22 },
      grande: { turnover: 180_000_000, ebitdaMargin: 0.21 },
    },
  },
  {
    cae3: "360",
    name: "Captação, tratamento e distribuição de água",
    bands: {
      micro: { turnover: 500_000, ebitdaMargin: 0.16 },
      pequena: { turnover: 4_500_000, ebitdaMargin: 0.19 },
      media: { turnover: 28_000_000, ebitdaMargin: 0.20 },
      grande: { turnover: 140_000_000, ebitdaMargin: 0.22 },
    },
  },
  {
    cae3: "381",
    name: "Recolha de resíduos",
    bands: {
      micro: { turnover: 400_000, ebitdaMargin: 0.14 },
      pequena: { turnover: 3_500_000, ebitdaMargin: 0.15 },
      media: { turnover: 22_000_000, ebitdaMargin: 0.16 },
      grande: { turnover: 110_000_000, ebitdaMargin: 0.17 },
    },
  },
  {
    cae3: "471",
    name: "Comércio a retalho em estabelecimentos não especializados",
    bands: {
      micro: { turnover: 350_000, ebitdaMargin: 0.05 },
      pequena: { turnover: 3_000_000, ebitdaMargin: 0.06 },
      media: { turnover: 25_000_000, ebitdaMargin: 0.07 },
      grande: { turnover: 250_000_000, ebitdaMargin: 0.06 },
    },
  },
  {
    cae3: "462",
    name: "Comércio por grosso de produtos agrícolas",
    bands: {
      micro: { turnover: 600_000, ebitdaMargin: 0.04 },
      pequena: { turnover: 5_500_000, ebitdaMargin: 0.04 },
      media: { turnover: 30_000_000, ebitdaMargin: 0.05 },
      grande: { turnover: 150_000_000, ebitdaMargin: 0.05 },
    },
  },
  {
    cae3: "620",
    name: "Atividades de programação informática, consultoria",
    bands: {
      micro: { turnover: 250_000, ebitdaMargin: 0.15 },
      pequena: { turnover: 2_500_000, ebitdaMargin: 0.18 },
      media: { turnover: 18_000_000, ebitdaMargin: 0.20 },
      grande: { turnover: 95_000_000, ebitdaMargin: 0.22 },
    },
  },
  {
    cae3: "711",
    name: "Atividades de arquitetura e engenharia",
    bands: {
      micro: { turnover: 180_000, ebitdaMargin: 0.10 },
      pequena: { turnover: 1_800_000, ebitdaMargin: 0.12 },
      media: { turnover: 14_000_000, ebitdaMargin: 0.13 },
      grande: { turnover: 60_000_000, ebitdaMargin: 0.14 },
    },
  },
  {
    cae3: "692",
    name: "Atividades de contabilidade, auditoria",
    bands: {
      micro: { turnover: 150_000, ebitdaMargin: 0.18 },
      pequena: { turnover: 1_400_000, ebitdaMargin: 0.20 },
      media: { turnover: 11_000_000, ebitdaMargin: 0.22 },
      grande: { turnover: 45_000_000, ebitdaMargin: 0.24 },
    },
  },
  {
    cae3: "561",
    name: "Restaurantes",
    bands: {
      micro: { turnover: 220_000, ebitdaMargin: 0.06 },
      pequena: { turnover: 1_600_000, ebitdaMargin: 0.08 },
      media: { turnover: 12_000_000, ebitdaMargin: 0.10 },
      grande: { turnover: 55_000_000, ebitdaMargin: 0.11 },
    },
  },
  {
    cae3: "552",
    name: "Alojamento mobilado para turistas",
    bands: {
      micro: { turnover: 300_000, ebitdaMargin: 0.10 },
      pequena: { turnover: 2_200_000, ebitdaMargin: 0.13 },
      media: { turnover: 16_000_000, ebitdaMargin: 0.15 },
      grande: { turnover: 80_000_000, ebitdaMargin: 0.17 },
    },
  },
];

const DIMENSOES: Dimensao[] = ["micro", "pequena", "media", "grande"];
const YEARS = [2022, 2023];
const FONTE = "placeholder_v1";

// Plausible peer counts — larger for smaller bands (long tail) so the UI's
// "n=N empresas" matches intuition.
const N_BY_DIMENSAO: Record<Dimensao, number> = {
  micro: 480,
  pequena: 180,
  media: 45,
  grande: 8,
};

interface SeedRow {
  cae3: string;
  dimensao: Dimensao;
  year: number;
  vintageYear: number;
  fonte: string;
  nCompanies: number;
  medianTurnover: string;
  medianEbitdaMargin: string;
}

function buildRows(): SeedRow[] {
  const rows: SeedRow[] = [];
  for (const sector of SECTORS) {
    for (const dimensao of DIMENSOES) {
      for (const year of YEARS) {
        const band = sector.bands[dimensao];
        rows.push({
          cae3: sector.cae3,
          dimensao,
          year,
          // BdP Quadros do Setor publishes with a 2-year lag; placeholder
          // mirrors that cadence.
          vintageYear: year + 2,
          fonte: FONTE,
          nCompanies: N_BY_DIMENSAO[dimensao],
          medianTurnover: band.turnover.toFixed(2),
          medianEbitdaMargin: band.ebitdaMargin.toFixed(4),
        });
      }
    }
  }
  return rows;
}

async function main(): Promise<void> {
  const rows = buildRows();
  console.log(`Seeding ${rows.length} sector_aggregates rows…`);

  // Single multi-row upsert. ON CONFLICT covers re-running the seed —
  // pull EXCLUDED.* so each row's set values come from its own incoming
  // tuple (not the first row's values, which would corrupt every row
  // after the first if hard-coded).
  await db
    .insert(schema.sectorAggregates)
    .values(rows)
    .onConflictDoUpdate({
      target: [
        schema.sectorAggregates.cae3,
        schema.sectorAggregates.dimensao,
        schema.sectorAggregates.year,
        schema.sectorAggregates.fonte,
      ],
      set: {
        vintageYear: sql`excluded.vintage_year`,
        nCompanies: sql`excluded.n_companies`,
        medianTurnover: sql`excluded.median_turnover`,
        medianEbitdaMargin: sql`excluded.median_ebitda_margin`,
      },
    });

  console.log(`done — ${rows.length} rows ensured`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
