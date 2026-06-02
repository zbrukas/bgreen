// Dev-only: render the carbon-footprint fixture through a real
// Gotenberg and write the PDF (+ HTML) to apps/pdf/tmp/ for eyeballing.
// Not part of the service path or CI.
//
// Prereqs: Gotenberg running (compose service, host :3010).
//
// Run:
//   GOTENBERG_URL=http://localhost:3010 \
//   pnpm --filter @bgreen/pdf exec tsx scripts/render-fixture.ts
//
// Optional env: BRAND_COLOR (#hex), ORG_NAME, LOGO_URL.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { carbonFootprintFixture } from "../src/templates/__fixtures__/carbon-footprint.fixture.js";
import { renderTemplate } from "../src/templates/index.js";
import type { CarbonFootprintData } from "../src/templates/types.js";
import { HttpGotenbergClient } from "../src/gotenberg/client.js";

// VARIANT=sparse renders the leaner payload that apps/api actually
// composes from extracted record data (coarse per-scope sources, no
// trend/factors/notes) — proves that real-data shape is schema-valid
// and renders without empty pages.
const sparsePayload: CarbonFootprintData = {
  period: carbonFootprintFixture.period,
  footer: carbonFootprintFixture.footer,
  commentary: carbonFootprintFixture.commentary,
  title: "Pegada de Carbono",
  subtitle: "Inventário de emissões GEE — Âmbitos 1, 2 e 3 (GHG Protocol)",
  unitLabel: "tCO₂e",
  totalTco2e: 1700,
  scopes: [
    { scope: "1", label: "Emissões diretas", tco2e: 1000 },
    { scope: "2", label: "Energia adquirida (localização)", tco2e: 500 },
    { scope: "3", label: "Cadeia de valor", tco2e: 200 },
  ],
  sources: [
    { scope: "1", category: "Emissões diretas", source: "Total Âmbito 1", tco2e: 1000 },
    { scope: "2", category: "Energia adquirida", source: "Eletricidade (localização)", tco2e: 500 },
    { scope: "3", category: "Cadeia de valor", source: "1 — Bens e serviços adquiridos", tco2e: 120 },
    { scope: "3", category: "Cadeia de valor", source: "4 — Transporte a montante", tco2e: 80 },
  ],
  kpis: [
    { label: "Âmbito 1", value: 1000, unit: "tCO₂e" },
    { label: "Âmbito 2", value: 500, unit: "tCO₂e" },
    { label: "Âmbito 3", value: 200, unit: "tCO₂e" },
  ],
  intensity: [
    { label: "Intensidade por volume de negócios", value: 0.34, unit: "tCO₂e / M€", decimals: 2 },
  ],
  trend: null,
  factors: [],
  methodologyNotes: [],
};

const here = dirname(fileURLToPath(import.meta.url));
const gotenbergUrl = process.env.GOTENBERG_URL ?? "http://localhost:3010";
const primaryColor = process.env.BRAND_COLOR ?? "#16707a";
const organizationName = process.env.ORG_NAME ?? "Grupo Parapedra";
const logoUrl = process.env.LOGO_URL ?? null;

async function main(): Promise<void> {
  const variant = process.env.VARIANT ?? "rich";
  const data = variant === "sparse" ? sparsePayload : carbonFootprintFixture;
  const result = renderTemplate({
    template: "carbon-footprint",
    data,
    branding: { organizationName, logoUrl, primaryColor },
  });
  if (!result.ok) {
    console.error("render failed:", result.error, result.details ?? "");
    process.exit(1);
  }

  const outDir = resolve(here, "../tmp");
  mkdirSync(outDir, { recursive: true });
  const htmlPath = resolve(outDir, "carbon-footprint.html");
  writeFileSync(htmlPath, result.html);
  console.log(`wrote ${htmlPath} (${result.html.length} chars)`);

  const client = new HttpGotenbergClient({ baseUrl: gotenbergUrl });
  const bytes = await client.convertHtmlToPdf(result.html);
  const pdfPath = resolve(outDir, "carbon-footprint.pdf");
  writeFileSync(pdfPath, bytes);
  console.log(`wrote ${pdfPath} (${bytes.byteLength} bytes) via ${gotenbergUrl}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
