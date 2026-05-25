// V11.2 — payload shapes the three report templates accept.
//
// The V11.1 wire envelope is `{ template, data, branding }`. The
// envelope's `template` selects the schema below; each schema
// validates `data` for that template. Shared fields (period,
// commentary, footer) live inside `data` since they vary per
// template (a Custom report may omit commentary entirely; an
// ESRS E1 report mandates it).
//
// apps/api hydrates the payload in V11.3 (records → emissions
// totals, profile → header fields, AI commentary → sections).
// apps/pdf trusts the validated payload and renders.

import { z } from "zod";

// ── Shared sub-schemas ─────────────────────────────────────────────

const commentarySectionSchema = z.object({
  title: z.string().min(1).max(200),
  narrative: z.string().min(1).max(4000),
  callouts: z.array(z.string().min(1).max(500)).max(8).default([]),
});

const commentarySchema = z
  .object({
    sections: z.array(commentarySectionSchema).max(20),
  })
  .nullable();

const periodSchema = z.object({
  // ISO yyyy-mm-dd; apps/api emits dates not timestamps.
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const footerSchema = z.object({
  // ISO datetime with offset — appears as "Gerado a 2026-05-25 12:34"
  // on the PDF cover footer.
  generatedAt: z.string().datetime({ offset: true }),
  // 64-char hex SHA-256 from the V11.1 InputDataHasher.
  inputDataHash: z.string().regex(/^[0-9a-f]{64}$/),
});

const baseDataSchema = z.object({
  period: periodSchema,
  commentary: commentarySchema,
  footer: footerSchema,
});

export type CommentarySection = z.infer<typeof commentarySectionSchema>;
export type Commentary = z.infer<typeof commentarySchema>;
export type Period = z.infer<typeof periodSchema>;
export type Footer = z.infer<typeof footerSchema>;

// ── GHG Inventory ──────────────────────────────────────────────────

const ghgBreakdownRowSchema = z.object({
  category: z.string().min(1).max(120),
  // tCO2e — we accept negative for offsets / removals in v1.5 but
  // emissions themselves are >= 0.
  tco2e: z.number().finite(),
  // Optional sub-category descriptor (e.g., "Categoria 1 — Bens e
  // serviços adquiridos").
  note: z.string().max(240).optional(),
});

export const ghgInventoryDataSchema = baseDataSchema.extend({
  scope1: z.object({
    total: z.number().finite().min(0),
    rows: z.array(ghgBreakdownRowSchema).max(20),
  }),
  scope2: z.object({
    locationTotal: z.number().finite().min(0),
    marketTotal: z.number().finite().min(0).nullable(),
    rows: z.array(ghgBreakdownRowSchema).max(20),
  }),
  scope3: z.object({
    total: z.number().finite().min(0).nullable(),
    rows: z.array(ghgBreakdownRowSchema).max(30),
  }),
  intensity: z
    .object({
      // tCO2e per €M of revenue.
      perRevenue: z.number().finite().nullable(),
      perFte: z.number().finite().nullable(),
    })
    .nullable(),
});

export type GhgInventoryData = z.infer<typeof ghgInventoryDataSchema>;

// ── ESRS E1 ────────────────────────────────────────────────────────

const esrsDatapointRowSchema = z.object({
  code: z.string().min(1).max(64),
  title: z.string().min(1).max(200),
  status: z.enum(["covered", "partial", "missing"]),
  // Short pt-PT value summary the template renders next to status:
  // covered → measured value, partial → "Dados parciais", missing → "—".
  value: z.string().max(120).nullable(),
});

export const esrsE1DataSchema = baseDataSchema.extend({
  datapoints: z.array(esrsDatapointRowSchema).min(1).max(60),
  coverage: z.object({
    covered: z.number().int().min(0),
    partial: z.number().int().min(0),
    missing: z.number().int().min(0),
  }),
});

export type EsrsE1Data = z.infer<typeof esrsE1DataSchema>;

// ── Custom ────────────────────────────────────────────────────────

const customRowSchema = z.object({
  label: z.string().min(1).max(200),
  // Free-text value (numeric or qualitative). The template prints it
  // verbatim — apps/api decides formatting.
  value: z.string().min(1).max(200),
  note: z.string().max(400).optional(),
});

export const customDataSchema = baseDataSchema.extend({
  title: z.string().min(1).max(200),
  rows: z.array(customRowSchema).min(1).max(60),
});

export type CustomData = z.infer<typeof customDataSchema>;
