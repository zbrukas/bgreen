// V11.1 — wire shape between apps/api and apps/pdf.
//
// `template` is the in-code template id. `data` is the hydrated
// payload (records summary, AI commentary, metrics) — apps/pdf
// trusts the caller and renders without re-fetching.
// `branding` carries the org's logo + primary color so the template
// can apply them at render time; both nullable, defaults applied at
// the template level.

export type ReportTemplate = "ghg-inventory" | "esrs-e1" | "custom";

export interface BrandSnapshot {
  organizationId: string;
  organizationName: string;
  // S3 object key for the logo, or null when no logo uploaded. apps/pdf
  // resolves the URL by signing the key against the bGreen S3 bucket.
  logoKey: string | null;
  // Hex color string (e.g., "#0f6f3e") or null. Validated for
  // contrast at the route layer; apps/pdf assumes it's safe to render.
  primaryColor: string | null;
}

export interface PdfRenderInput {
  template: ReportTemplate;
  data: unknown;
  branding: BrandSnapshot;
}

export interface PdfRenderResult {
  bytes: Uint8Array;
}

export interface PdfRenderer {
  render(input: PdfRenderInput): Promise<PdfRenderResult>;
}

// Discriminated failure shape — same posture as @bgreen/storage. Lets
// callers (V11.3's ReportService) match on `kind` to map to pt-PT
// user messages. Every variant carries a human-readable `message` so
// the Error superclass has a sensible string to surface in logs.
export type PdfRenderError =
  | { kind: "auth"; message: string }
  | { kind: "transient"; message: string }
  | { kind: "template_not_found"; message: string; template: string }
  | { kind: "render_failed"; message: string };

export class PdfRenderException extends Error {
  constructor(public readonly error: PdfRenderError) {
    super(error.message);
    this.name = "PdfRenderException";
  }
}
