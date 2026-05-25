// InMemoryPdfRenderer — test double. Captures every call so V11.3
// service tests can assert what was sent without spinning up apps/pdf.

import type {
  PdfRenderInput,
  PdfRenderResult,
  PdfRenderer,
} from "./types.js";

// Stable 8-byte stub. Real PDFs start with "%PDF-1.4\n" + binary.
// Tests don't parse, they just check the byte count is non-zero.
const STUB_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x73, 0x74, 0x62,
]); // "%PDF-stb"

export class InMemoryPdfRenderer implements PdfRenderer {
  readonly calls: PdfRenderInput[] = [];
  private nextResult: PdfRenderResult | Error = { bytes: STUB_BYTES };

  setNext(result: PdfRenderResult | Error): void {
    this.nextResult = result;
  }

  async render(input: PdfRenderInput): Promise<PdfRenderResult> {
    this.calls.push(input);
    if (this.nextResult instanceof Error) throw this.nextResult;
    return this.nextResult;
  }
}
