// V11.2 — template registry. Maps the V11.1 ReportTemplate enum to
// (zod data schema, React component, document title). Exposed
// through renderTemplate() which validates the payload, server-
// renders, wraps in a print-ready HTML document, and returns the
// full HTML string for Gotenberg.

import { renderToStaticMarkup } from "react-dom/server";
import type { ZodTypeAny } from "zod";
import { CustomTemplate } from "./custom.js";
import { EsrsE1Template } from "./esrs-e1.js";
import { GhgInventoryTemplate } from "./ghg-inventory.js";
import { TEMPLATE_CSS } from "./styles.js";
import {
  type CustomData,
  type EsrsE1Data,
  type GhgInventoryData,
  customDataSchema,
  esrsE1DataSchema,
  ghgInventoryDataSchema,
} from "./types.js";

export type TemplateId = "ghg-inventory" | "esrs-e1" | "custom";

interface BrandingForRender {
  organizationName: string;
  logoUrl: string | null;
  primaryColor: string | null;
}

// Generic over the zod schema type so callers don't have to keep the
// schema's input + output types in sync (the `.default([])` on
// commentary callouts makes them diverge).
interface TemplateRegistryEntry<TSchema extends ZodTypeAny, TData> {
  schema: TSchema;
  documentTitle: (data: TData, branding: BrandingForRender) => string;
  render: (data: TData, branding: BrandingForRender) => string;
}

const ghgEntry: TemplateRegistryEntry<typeof ghgInventoryDataSchema, GhgInventoryData> = {
  schema: ghgInventoryDataSchema,
  documentTitle: (_, b) => `Inventário GEE — ${b.organizationName}`,
  render: (data, branding) =>
    renderToStaticMarkup(
      <GhgInventoryTemplate
        data={data}
        brandingName={branding.organizationName}
        brandPrimaryColor={branding.primaryColor}
        logoUrl={branding.logoUrl}
      />,
    ),
};

const esrsEntry: TemplateRegistryEntry<typeof esrsE1DataSchema, EsrsE1Data> = {
  schema: esrsE1DataSchema,
  documentTitle: (_, b) => `ESRS E1 — ${b.organizationName}`,
  render: (data, branding) =>
    renderToStaticMarkup(
      <EsrsE1Template
        data={data}
        brandingName={branding.organizationName}
        brandPrimaryColor={branding.primaryColor}
        logoUrl={branding.logoUrl}
      />,
    ),
};

const customEntry: TemplateRegistryEntry<typeof customDataSchema, CustomData> = {
  schema: customDataSchema,
  documentTitle: (data, b) => `${data.title} — ${b.organizationName}`,
  render: (data, branding) =>
    renderToStaticMarkup(
      <CustomTemplate
        data={data}
        brandingName={branding.organizationName}
        brandPrimaryColor={branding.primaryColor}
        logoUrl={branding.logoUrl}
      />,
    ),
};

// The registry is the integration boundary. Discriminating callers
// look up by TemplateId; unknown ids return null so the route layer
// can return 404 cleanly (HttpPdfRenderer maps to template_not_found).
type AnyEntry =
  | TemplateRegistryEntry<typeof ghgInventoryDataSchema, GhgInventoryData>
  | TemplateRegistryEntry<typeof esrsE1DataSchema, EsrsE1Data>
  | TemplateRegistryEntry<typeof customDataSchema, CustomData>;

const REGISTRY: Record<TemplateId, AnyEntry> = {
  "ghg-inventory": ghgEntry,
  "esrs-e1": esrsEntry,
  custom: customEntry,
};

export type RenderTemplateResult =
  | { ok: true; html: string }
  | { ok: false; error: "template_not_found" | "invalid_payload"; details?: string };

export function renderTemplate(input: {
  template: string;
  data: unknown;
  branding: BrandingForRender;
}): RenderTemplateResult {
  const entry = REGISTRY[input.template as TemplateId];
  if (!entry) return { ok: false, error: "template_not_found" };

  const parsed = entry.schema.safeParse(input.data);
  if (!parsed.success) {
    return {
      ok: false,
      error: "invalid_payload",
      details: parsed.error.message,
    };
  }

  // The TData generic on the entry doesn't survive the union widening;
  // safeParse already validated, so the cast is sound at runtime.
  const markup = (entry.render as (d: unknown, b: BrandingForRender) => string)(
    parsed.data,
    input.branding,
  );
  const title = (entry.documentTitle as (d: unknown, b: BrandingForRender) => string)(
    parsed.data,
    input.branding,
  );

  const html = wrapDocument(title, markup);
  return { ok: true, html };
}

function wrapDocument(title: string, body: string): string {
  // Self-contained HTML document so Gotenberg renders with the same
  // visual output regardless of remote-asset availability. Logo
  // images still load remotely (when an https URL is present in the
  // payload); the CSS is inlined.
  return [
    "<!doctype html>",
    "<html lang=\"pt-PT\">",
    "<head>",
    "<meta charset=\"utf-8\" />",
    `<title>${escapeHtml(title)}</title>`,
    `<style>${TEMPLATE_CSS}</style>`,
    "</head>",
    "<body>",
    body,
    "</body>",
    "</html>",
  ].join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
