// HttpPdfRenderer — apps/api side adapter. POSTs to apps/pdf's
// /render endpoint with the shared-secret header. Returns PDF bytes
// or throws PdfRenderException with a discriminated PdfRenderError so
// the calling service can map to pt-PT user-facing messages.
//
// Network errors map to "transient". 401/403 maps to "auth" (a
// misconfigured PDF_INTERNAL_TOKEN should fail loud at boot, not
// silently produce broken reports). 404 with body.error="template_not_found"
// surfaces that distinction; other 4xx/5xx become "render_failed".

import {
  type PdfRenderError,
  PdfRenderException,
  type PdfRenderInput,
  type PdfRenderResult,
  type PdfRenderer,
} from "./types.js";

export interface HttpPdfRendererOptions {
  baseUrl: string;
  internalToken: string;
  // Bound request body size at the call site. Gotenberg has its own
  // limit; this is a belt-and-braces guard against accidentally
  // streaming the entire records table into one report.
  maxRequestBytes?: number;
}

const DEFAULT_MAX_REQUEST_BYTES = 4 * 1024 * 1024; // 4MB

export class HttpPdfRenderer implements PdfRenderer {
  private readonly baseUrl: string;
  private readonly internalToken: string;
  private readonly maxRequestBytes: number;

  constructor(options: HttpPdfRendererOptions) {
    // Strip trailing slash so url joining is deterministic regardless
    // of how the env var was set.
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.internalToken = options.internalToken;
    this.maxRequestBytes = options.maxRequestBytes ?? DEFAULT_MAX_REQUEST_BYTES;
  }

  async render(input: PdfRenderInput): Promise<PdfRenderResult> {
    const body = JSON.stringify(input);
    if (body.length > this.maxRequestBytes) {
      throw new PdfRenderException({
        kind: "render_failed",
        message: `request body ${body.length}B exceeds limit ${this.maxRequestBytes}B`,
      });
    }

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/render`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": this.internalToken,
        },
        body,
      });
    } catch (e) {
      throw new PdfRenderException({
        kind: "transient",
        message: e instanceof Error ? e.message : String(e),
      });
    }

    if (response.status === 401 || response.status === 403) {
      throw new PdfRenderException({
        kind: "auth",
        message: `apps/pdf rejected the internal token (${response.status})`,
      });
    }

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}) as { error?: string });
      const error: PdfRenderError =
        response.status === 404 &&
        (errorBody as { error?: string }).error === "template_not_found"
          ? {
              kind: "template_not_found",
              message: `apps/pdf does not know template '${input.template}'`,
              template: input.template,
            }
          : response.status >= 500
            ? {
                kind: "transient",
                message: `apps/pdf ${response.status} ${(errorBody as { error?: string }).error ?? ""}`,
              }
            : {
                kind: "render_failed",
                message: `apps/pdf ${response.status} ${(errorBody as { error?: string }).error ?? ""}`,
              };
      throw new PdfRenderException(error);
    }

    const buffer = await response.arrayBuffer();
    return { bytes: new Uint8Array(buffer) };
  }
}
