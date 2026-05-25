// V11.2 — Gotenberg HTTP client.
//
// Gotenberg's /forms/chromium/convert/html endpoint accepts a
// multipart/form-data POST with an `index.html` file part plus
// optional knobs (paper size, margins, wait timeouts). Returns
// application/pdf bytes on success.
//
// The HTTP impl wraps fetch. The InMemory impl returns a stable
// "%PDF-stub" placeholder for tests + dev environments without
// Gotenberg running (so `pnpm dev` doesn't require Docker).

export interface GotenbergClient {
  convertHtmlToPdf(html: string): Promise<Uint8Array>;
}

export type GotenbergError =
  | { kind: "transient"; message: string }
  | { kind: "render_failed"; message: string };

export class GotenbergException extends Error {
  constructor(public readonly error: GotenbergError) {
    super(error.message);
    this.name = "GotenbergException";
  }
}

export interface HttpGotenbergClientOptions {
  baseUrl: string;
  // Max time Gotenberg waits for Chromium to finish loading the
  // page. Defaults to 30s — enough for templates with remote logos
  // but small enough to fail fast on hung renders.
  waitTimeout?: string;
}

export class HttpGotenbergClient implements GotenbergClient {
  private readonly baseUrl: string;
  private readonly waitTimeout: string;

  constructor(options: HttpGotenbergClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.waitTimeout = options.waitTimeout ?? "30s";
  }

  async convertHtmlToPdf(html: string): Promise<Uint8Array> {
    const form = new FormData();
    // Gotenberg expects the HTML payload as a file part named
    // `files`. The file's filename must literally be index.html —
    // Chromium loads it as the entry point.
    form.append(
      "files",
      new Blob([html], { type: "text/html" }),
      "index.html",
    );
    form.append("waitTimeout", this.waitTimeout);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/forms/chromium/convert/html`, {
        method: "POST",
        body: form,
      });
    } catch (e) {
      throw new GotenbergException({
        kind: "transient",
        message: e instanceof Error ? e.message : String(e),
      });
    }

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      // Gotenberg returns 5xx for transient overload + 4xx for
      // payload-level failures (HTML too big, malformed multipart).
      const kind = response.status >= 500 ? "transient" : "render_failed";
      throw new GotenbergException({
        kind,
        message: `gotenberg ${response.status}: ${detail.slice(0, 200)}`,
      });
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }
}

// In-memory fallback. Returns a deterministic placeholder PDF so
// route smoke-tests + local dev don't need a Gotenberg container.
// Real renders need GOTENBERG_URL configured.
export class InMemoryGotenbergClient implements GotenbergClient {
  readonly calls: string[] = [];

  async convertHtmlToPdf(html: string): Promise<Uint8Array> {
    this.calls.push(html);
    // Minimal valid PDF (8 bytes): %PDF-1.4\n followed by a header
    // is enough for byte-level assertions; a real reader needs
    // xref tables we don't bother emitting.
    return new TextEncoder().encode("%PDF-stub-1.4\n");
  }
}

export function buildGotenbergClient(): GotenbergClient {
  const url = process.env.GOTENBERG_URL;
  if (!url) return new InMemoryGotenbergClient();
  return new HttpGotenbergClient({ baseUrl: url });
}
