// V11.2 — template registry tests. Focused on the contract: each
// template id renders without throwing, returns a self-contained
// HTML document with the inline CSS, and surfaces invalid payloads
// as a typed error (not an exception).

import { describe, expect, it } from "vitest";
import { renderTemplate } from "./index.js";
import type {
  CustomData,
  EsrsE1Data,
  GhgInventoryData,
} from "./types.js";

const baseEnvelope = {
  branding: {
    organizationName: "ACME Energia",
    logoUrl: null,
    primaryColor: null,
  },
};

const baseFooter = {
  generatedAt: "2026-05-25T12:00:00.000Z",
  inputDataHash:
    "43258cff783fe7036d8a43033f830adfc60ec037382473548ac742b888292777",
};

const basePeriod = { start: "2025-01-01", end: "2025-12-31" };

const baseCommentary = {
  sections: [
    {
      title: "Resumo",
      narrative: "Texto em pt-PT com pelo menos um carácter.",
      callouts: ["Callout 1"],
    },
  ],
};

describe("renderTemplate — ghg-inventory", () => {
  it("renders a valid payload to an HTML document with inline CSS", () => {
    const data: GhgInventoryData = {
      period: basePeriod,
      commentary: baseCommentary,
      footer: baseFooter,
      scope1: {
        total: 1234.5,
        rows: [{ category: "Combustão fixa", tco2e: 1100, note: "Caldeiras" }],
      },
      scope2: {
        locationTotal: 800,
        marketTotal: 600,
        rows: [{ category: "Eletricidade adquirida", tco2e: 600 }],
      },
      scope3: { total: 5000, rows: [] },
      intensity: { perRevenue: 12.3, perFte: 4.5 },
    };
    const result = renderTemplate({
      template: "ghg-inventory",
      data,
      ...baseEnvelope,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("<!doctype html>");
    expect(result.html).toContain("Inventário de Emissões GEE");
    expect(result.html).toContain("ACME Energia");
    expect(result.html).toContain("Combustão fixa");
    // Inline CSS embedded.
    expect(result.html).toContain("@page");
    // Hash echoed verbatim in the footer.
    expect(result.html).toContain(baseFooter.inputDataHash);
  });

  it("missing scope1 total → invalid_payload", () => {
    const result = renderTemplate({
      template: "ghg-inventory",
      data: {
        period: basePeriod,
        commentary: null,
        footer: baseFooter,
        scope2: { locationTotal: 0, marketTotal: null, rows: [] },
        scope3: { total: null, rows: [] },
        intensity: null,
      },
      ...baseEnvelope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("invalid_payload");
  });
});

describe("renderTemplate — esrs-e1", () => {
  it("renders a valid payload with the datapoint matrix + counts", () => {
    const data: EsrsE1Data = {
      period: basePeriod,
      commentary: baseCommentary,
      footer: baseFooter,
      coverage: { covered: 5, partial: 3, missing: 22 },
      datapoints: [
        { code: "E1-6", title: "Emissões Âmbito 1", status: "covered", value: "1.234 tCO2e" },
        { code: "E1-1", title: "Plano de transição", status: "missing", value: null },
      ],
    };
    const result = renderTemplate({
      template: "esrs-e1",
      data,
      ...baseEnvelope,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("ESRS E1");
    expect(result.html).toContain("E1-6");
    expect(result.html).toContain("Coberto");
    expect(result.html).toContain("Em falta");
  });
});

describe("renderTemplate — custom", () => {
  it("renders the user-selected rows with the user-supplied title", () => {
    const data: CustomData = {
      period: basePeriod,
      commentary: null,
      footer: baseFooter,
      title: "Resumo Energético 2025",
      rows: [
        { label: "Consumo total", value: "1.234 MWh" },
        { label: "% renovável", value: "42 %", note: "Inclui PPAs" },
      ],
    };
    const result = renderTemplate({
      template: "custom",
      data,
      ...baseEnvelope,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("Resumo Energético 2025");
    expect(result.html).toContain("Consumo total");
    expect(result.html).toContain("Inclui PPAs");
  });

  it("respects the brand primary color in the cover heading", () => {
    const data: CustomData = {
      period: basePeriod,
      commentary: null,
      footer: baseFooter,
      title: "X",
      rows: [{ label: "a", value: "b" }],
    };
    const result = renderTemplate({
      template: "custom",
      data,
      branding: {
        organizationName: "Brand Inc",
        logoUrl: null,
        primaryColor: "#ff00aa",
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.html).toContain("#ff00aa");
  });
});

describe("renderTemplate — registry boundary", () => {
  it("unknown template id → template_not_found", () => {
    const result = renderTemplate({
      template: "does-not-exist",
      data: {},
      ...baseEnvelope,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("template_not_found");
  });

  it("renders without a logo when branding.logoUrl is null", () => {
    const data: CustomData = {
      period: basePeriod,
      commentary: null,
      footer: baseFooter,
      title: "X",
      rows: [{ label: "a", value: "b" }],
    };
    const result = renderTemplate({
      template: "custom",
      data,
      ...baseEnvelope,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Fallback logo wordmark when no logo uploaded.
    expect(result.html).toContain("bGreen");
  });
});
