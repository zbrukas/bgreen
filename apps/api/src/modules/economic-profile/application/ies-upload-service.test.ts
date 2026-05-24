import { InMemoryS3Uploader } from "@bgreen/storage";
import { describe, expect, it } from "vitest";
import type {
  ExtractedEconomicProfile,
  IesExtractionLog,
  ValidatorWarning,
} from "../domain/types.js";
import type { IesExtractionLogRepository } from "../infrastructure/ies-extraction-log-repository.js";
import {
  IesUploadService,
  type InngestEventSender,
  MAX_IES_SIZE_BYTES,
  buildS3Key,
} from "./ies-upload-service.js";

// Minimal in-memory log repo (mirrors the shape used in the extraction
// service tests). Records every update so we can assert the post-upload
// status changes when something goes wrong.
class InMemoryLogRepo implements IesExtractionLogRepository {
  private readonly logs = new Map<string, IesExtractionLog>();
  private nextId = 1;

  insert(input: Parameters<IesExtractionLogRepository["insert"]>[0]): Promise<IesExtractionLog> {
    const id = `log-${this.nextId++}`;
    const log: IesExtractionLog = {
      id,
      organizationId: input.organizationId,
      uploadedByUserId: input.uploadedByUserId,
      s3Key: input.s3Key,
      s3DeletedAt: null,
      originalFilename: input.originalFilename,
      fileSizeBytes: input.fileSizeBytes,
      status: "pending",
      year: null,
      classificationResult: null,
      extractionResult: null,
      validatorWarnings: null,
      errorMessage: null,
      inngestRunId: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.logs.set(id, log);
    return Promise.resolve(log);
  }
  findAnyById(id: string): Promise<IesExtractionLog | null> {
    return Promise.resolve(this.logs.get(id) ?? null);
  }
  findById(orgId: string, id: string): Promise<IesExtractionLog | null> {
    const log = this.logs.get(id);
    if (!log || log.organizationId !== orgId) return Promise.resolve(null);
    return Promise.resolve(log);
  }
  update(
    id: string,
    fields: Parameters<IesExtractionLogRepository["update"]>[1],
  ): Promise<IesExtractionLog | null> {
    const current = this.logs.get(id);
    if (!current) return Promise.resolve(null);
    const next: IesExtractionLog = {
      ...current,
      ...(fields.status !== undefined ? { status: fields.status } : {}),
      ...(fields.errorMessage !== undefined ? { errorMessage: fields.errorMessage } : {}),
      ...(fields.s3Key !== undefined ? { s3Key: fields.s3Key } : {}),
      ...(fields.extractionResult !== undefined
        ? { extractionResult: fields.extractionResult as ExtractedEconomicProfile | null }
        : {}),
      ...(fields.validatorWarnings !== undefined
        ? { validatorWarnings: fields.validatorWarnings as ValidatorWarning[] | null }
        : {}),
    };
    this.logs.set(id, next);
    return Promise.resolve(next);
  }
}

function recordingSender(): InngestEventSender & { events: Array<{ name: string; data: unknown }> } {
  const events: Array<{ name: string; data: unknown }> = [];
  return {
    events,
    send: async (event) => {
      events.push(event);
    },
  };
}

function pdfBytes(size: number): Uint8Array {
  return new Uint8Array(size);
}

describe("IesUploadService.start", () => {
  it("happy path — uploads to S3, persists log, fires inngest event", async () => {
    const repo = new InMemoryLogRepo();
    const s3 = new InMemoryS3Uploader();
    const events = recordingSender();
    const service = new IesUploadService(repo, s3, events);

    const result = await service.start({
      organizationId: "org-1",
      userId: "user-1",
      filename: "IES-2024.pdf",
      mimeType: "application/pdf",
      body: pdfBytes(1024),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.log.s3Key).toBe(buildS3Key("org-1", result.log.id));
    expect(s3.has(result.log.s3Key as string)).toBe(true);
    expect(events.events).toHaveLength(1);
    expect(events.events[0]?.name).toBe("ies.extraction.started");
    expect((events.events[0]?.data as { logId: string }).logId).toBe(result.log.id);
  });

  it("rejects empty files without touching S3", async () => {
    const repo = new InMemoryLogRepo();
    const s3 = new InMemoryS3Uploader();
    const events = recordingSender();
    const service = new IesUploadService(repo, s3, events);

    const result = await service.start({
      organizationId: "org-1",
      userId: "user-1",
      filename: "empty.pdf",
      mimeType: "application/pdf",
      body: pdfBytes(0),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("empty_file");
    expect(s3.size()).toBe(0);
    expect(events.events).toHaveLength(0);
  });

  it("rejects files over the 25 MB cap", async () => {
    const repo = new InMemoryLogRepo();
    const s3 = new InMemoryS3Uploader();
    const events = recordingSender();
    const service = new IesUploadService(repo, s3, events);

    const result = await service.start({
      organizationId: "org-1",
      userId: "user-1",
      filename: "huge.pdf",
      mimeType: "application/pdf",
      body: pdfBytes(MAX_IES_SIZE_BYTES + 1),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("too_large");
    expect(s3.size()).toBe(0);
  });

  it("rejects non-PDF MIME types", async () => {
    const repo = new InMemoryLogRepo();
    const s3 = new InMemoryS3Uploader();
    const events = recordingSender();
    const service = new IesUploadService(repo, s3, events);

    const result = await service.start({
      organizationId: "org-1",
      userId: "user-1",
      filename: "spreadsheet.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: pdfBytes(1024),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("not_pdf");
  });

  it("accepts empty MIME type when filename ends in .pdf (Safari fallback)", async () => {
    const repo = new InMemoryLogRepo();
    const s3 = new InMemoryS3Uploader();
    const events = recordingSender();
    const service = new IesUploadService(repo, s3, events);

    const result = await service.start({
      organizationId: "org-1",
      userId: "user-1",
      filename: "report.pdf",
      mimeType: "",
      body: pdfBytes(1024),
    });

    expect(result.ok).toBe(true);
  });

  it("marks the log failed when the inngest send throws", async () => {
    const repo = new InMemoryLogRepo();
    const s3 = new InMemoryS3Uploader();
    const events: InngestEventSender = {
      send: () => Promise.reject(new Error("inngest dev server down")),
    };
    const service = new IesUploadService(repo, s3, events);

    const result = await service.start({
      organizationId: "org-1",
      userId: "user-1",
      filename: "IES-2024.pdf",
      mimeType: "application/pdf",
      body: pdfBytes(1024),
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("storage_failed");
    // Log was created and then marked failed.
    const allLogs = await Promise.all([repo.findAnyById("log-1")]);
    expect(allLogs[0]?.status).toBe("failed_extraction");
  });
});
