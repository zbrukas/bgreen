// IesUploadService — accepts an IES PDF, persists the log row, uploads
// to S3, and kicks off the extraction Inngest event.
//
// Lives between the HTTP route (V6.4) and the Inngest function (V6.3).
// The route validates auth + multipart parsing; this service owns the
// invariants: size cap, MIME check, key naming, and the
// log-row-before-S3-write ordering (so a partially-uploaded S3 object
// always has a log row to clean up against).

import type { S3Uploader } from "@bgreen/storage";
import type {
  IesExtractionLog,
  IesExtractionStatus,
} from "../domain/types.js";
import type { IesExtractionLogRepository } from "../infrastructure/ies-extraction-log-repository.js";

// 25 MB cap per the V6 plan. Anthropic's PDF limit is 32 MB; we stay
// comfortably under to leave room for base64 expansion (~33% overhead).
export const MAX_IES_SIZE_BYTES = 25 * 1024 * 1024;

// One discriminator over both upload-validation failures (size, MIME)
// and downstream failures (S3, DB). Keeps the route layer's error
// handling exhaustive.
export type IesUploadError =
  | { kind: "too_large"; actualBytes: number; maxBytes: number }
  | { kind: "not_pdf"; receivedMimeType: string }
  | { kind: "empty_file" }
  | { kind: "storage_failed"; reason: string };

export type IesUploadResult =
  | { ok: true; log: IesExtractionLog }
  | { ok: false; error: IesUploadError };

// Sender abstraction so tests can substitute. The default impl wraps
// `inngest.send(...)`. We only ever fire one event name today; if the
// surface grows, the abstraction stays narrow.
export interface InngestEventSender {
  send(event: { name: "ies.extraction.started"; data: { logId: string } }): Promise<void>;
}

export class IesUploadService {
  constructor(
    private readonly repo: IesExtractionLogRepository,
    private readonly s3: S3Uploader,
    private readonly events: InngestEventSender,
  ) {}

  async start(input: {
    organizationId: string;
    userId: string;
    filename: string;
    mimeType: string;
    body: Uint8Array;
  }): Promise<IesUploadResult> {
    // Boundary validation. The route also does basic checks but we
    // re-do them here so direct service callers (future internal tools)
    // can't sidestep.
    if (input.body.byteLength === 0) {
      return { ok: false, error: { kind: "empty_file" } };
    }
    if (input.body.byteLength > MAX_IES_SIZE_BYTES) {
      return {
        ok: false,
        error: {
          kind: "too_large",
          actualBytes: input.body.byteLength,
          maxBytes: MAX_IES_SIZE_BYTES,
        },
      };
    }
    // Some browsers send empty mimeType; treat that as PDF only if the
    // filename ends in .pdf. Otherwise reject.
    const mime = input.mimeType.toLowerCase();
    const looksLikePdfByName = input.filename.toLowerCase().endsWith(".pdf");
    if (mime !== "application/pdf" && !(mime === "" && looksLikePdfByName)) {
      return { ok: false, error: { kind: "not_pdf", receivedMimeType: input.mimeType } };
    }

    // Insert the log row first so a half-baked S3 upload always has a
    // domain entity to clean up against. We don't know the final key
    // until we have the log id, so insert with a placeholder + update
    // — except we can't actually do that without an empty key, so we
    // compute the key from a UUID, insert with it, then upload.
    //
    // The `insert` returns a log with the persisted id. The S3 key
    // embeds that id; upload uses it; if upload fails, the log row
    // stays as `pending` and never advances — the future cleanup job
    // (deferred to V6.5 or later) will sweep pending rows older than
    // an hour. For v1 this is acceptable: zero customers, zero dust.
    const log = await this.repo.insert({
      organizationId: input.organizationId,
      uploadedByUserId: input.userId,
      // Temporary placeholder — overwritten right after we know the id.
      s3Key: `organizations/${input.organizationId}/ies/PLACEHOLDER.pdf`,
      originalFilename: input.filename,
      fileSizeBytes: input.body.byteLength,
    });

    const key = buildS3Key(input.organizationId, log.id);
    await this.repo.update(log.id, { s3Key: key });

    const upload = await this.s3.upload({
      key,
      body: input.body,
      contentType: "application/pdf",
      maxSizeBytes: MAX_IES_SIZE_BYTES,
    });
    if (!upload.ok) {
      // Mark the log as failed so a UI poll surfaces the failure.
      const failedStatus: IesExtractionStatus = "failed_extraction";
      await this.repo.update(log.id, {
        status: failedStatus,
        errorMessage: "Falha ao guardar o documento. Tente novamente.",
        completedAt: new Date(),
      });
      return { ok: false, error: { kind: "storage_failed", reason: upload.error.message } };
    }

    // Fire the Inngest event. If this fails, the upload is in S3 but
    // the pipeline never runs — surface as storage_failed so the user
    // retries. Future hardening: outbox table.
    try {
      await this.events.send({
        name: "ies.extraction.started",
        data: { logId: log.id },
      });
    } catch (e) {
      await this.repo.update(log.id, {
        status: "failed_extraction",
        errorMessage: "Falha a iniciar a extração. Tente novamente.",
        completedAt: new Date(),
      });
      return {
        ok: false,
        error: {
          kind: "storage_failed",
          reason: e instanceof Error ? e.message : String(e),
        },
      };
    }

    const finalLog = await this.repo.findAnyById(log.id);
    return { ok: true, log: finalLog ?? log };
  }
}

export function buildS3Key(organizationId: string, logId: string): string {
  return `organizations/${organizationId}/ies/${logId}.pdf`;
}
