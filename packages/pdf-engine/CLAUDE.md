# packages/pdf-engine — PdfRenderer interface + apps/pdf client

Bounded context: apps/api → apps/pdf transport. apps/api hands a
hydrated payload (template id + data + branding); the adapter POSTs
to apps/pdf and returns the PDF bytes.

## Owns
- `PdfRenderer` interface: `render(input) → Promise<{ bytes }>`.
- `HttpPdfRenderer` adapter — POSTs to apps/pdf with the internal
  shared-secret header.
- `InMemoryPdfRenderer` test double — returns a placeholder Uint8Array
  so service tests don't need apps/pdf running.

## Does NOT own
- React templates (live in `apps/pdf/templates/`).
- Gotenberg transport (apps/pdf owns that internally).
- AI commentary (apps/api owns that; passes commentary in the payload).
- S3 storage (apps/api owns that around the PDF bytes).

## Auth
- Shared-secret header (`X-Internal-Token`) set from
  `PDF_INTERNAL_TOKEN` env var. apps/pdf rejects requests without
  the matching token.
