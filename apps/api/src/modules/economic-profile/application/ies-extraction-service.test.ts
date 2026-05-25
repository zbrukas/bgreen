import {
  type AiCallContext,
  type AiClient,
  type AiError,
  type AiToolDefinition,
  type Result,
  aiError,
  err,
  ok,
} from "@bgreen/ai";
import { InMemoryS3Uploader, type StorageError } from "@bgreen/storage";
import { describe, expect, it } from "vitest";
import type {
  ExtractedEconomicProfile,
  IesExtractionLog,
  IesExtractionStatus,
  ValidatorWarning,
} from "../domain/types.js";
import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../infrastructure/economic-profile-repository.js";
import type { IesExtractionLogRepository } from "../infrastructure/ies-extraction-log-repository.js";
import { IesExtractionService } from "./ies-extraction-service.js";

// Minimal in-memory EconomicProfileRepository. Keys on (orgId, year).
class InMemoryProfileRepo implements EconomicProfileRepository {
  readonly profiles = new Map<string, OrganizationEconomicProfile>();

  private key(orgId: string, year: number): string {
    return `${orgId}::${year}`;
  }

  upsert(input: Parameters<EconomicProfileRepository["upsert"]>[0]) {
    const existing = this.profiles.get(this.key(input.organizationId, input.year));
    const now = new Date().toISOString();
    const profile: OrganizationEconomicProfile = {
      id: existing?.id ?? `profile-${this.profiles.size + 1}`,
      organizationId: input.organizationId,
      year: input.year,
      employees: input.employees,
      turnover: input.turnover,
      ebitda: input.ebitda,
      balanceSheetTotal: input.balanceSheetTotal,
      cae: input.cae,
      source: input.source,
      confirmedAt: now,
      iesExtractionLogId: input.iesExtractionLogId,
      dimensao: existing?.dimensao ?? null,
      dimensaoSource: existing?.dimensaoSource ?? null,
      dimensaoConfirmedAt: existing?.dimensaoConfirmedAt ?? null,
      dimensaoRationale: existing?.dimensaoRationale ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.profiles.set(this.key(input.organizationId, input.year), profile);
    return Promise.resolve(profile);
  }

  findByOrgYear(orgId: string, year: number) {
    return Promise.resolve(this.profiles.get(this.key(orgId, year)) ?? null);
  }

  listByOrg(orgId: string) {
    return Promise.resolve(
      Array.from(this.profiles.values()).filter((p) => p.organizationId === orgId),
    );
  }

  setDimensao(input: Parameters<EconomicProfileRepository["setDimensao"]>[0]) {
    const current = this.profiles.get(this.key(input.organizationId, input.year));
    if (!current) return Promise.resolve(null);
    const updated: OrganizationEconomicProfile = {
      ...current,
      dimensao: input.dimensao,
      dimensaoSource: input.source,
      dimensaoConfirmedAt: new Date().toISOString(),
      dimensaoRationale: input.rationale,
      updatedAt: new Date().toISOString(),
    };
    this.profiles.set(this.key(input.organizationId, input.year), updated);
    return Promise.resolve(updated);
  }
}

// Per-test in-memory log repo. Mirrors the Drizzle repo's contract
// without touching the database. We track update history so tests can
// assert on per-step transitions ("status moved through extracting →
// awaiting_user_confirmation").
class InMemoryLogRepo implements IesExtractionLogRepository {
  private readonly logs = new Map<string, IesExtractionLog>();
  // Public for test assertions — observe the order of partial updates.
  readonly updates: Array<{ id: string; fields: Record<string, unknown> }> = [];

  seed(log: IesExtractionLog): void {
    this.logs.set(log.id, log);
  }

  insert(): never {
    throw new Error("not used in tests — seed() directly");
  }

  findAnyById(id: string): Promise<IesExtractionLog | null> {
    return Promise.resolve(this.logs.get(id) ?? null);
  }

  findById(organizationId: string, id: string): Promise<IesExtractionLog | null> {
    const log = this.logs.get(id);
    if (!log || log.organizationId !== organizationId) return Promise.resolve(null);
    return Promise.resolve(log);
  }

  update(
    id: string,
    fields: Parameters<IesExtractionLogRepository["update"]>[1],
  ): Promise<IesExtractionLog | null> {
    this.updates.push({ id, fields: { ...fields } });
    const current = this.logs.get(id);
    if (!current) return Promise.resolve(null);
    const updated: IesExtractionLog = {
      ...current,
      ...(fields.status !== undefined ? { status: fields.status } : {}),
      ...(fields.year !== undefined ? { year: fields.year } : {}),
      ...(fields.errorMessage !== undefined ? { errorMessage: fields.errorMessage } : {}),
      ...(fields.classificationResult !== undefined
        ? { classificationResult: fields.classificationResult }
        : {}),
      ...(fields.extractionResult !== undefined
        ? { extractionResult: fields.extractionResult as ExtractedEconomicProfile | null }
        : {}),
      ...(fields.validatorWarnings !== undefined
        ? { validatorWarnings: fields.validatorWarnings as ValidatorWarning[] | null }
        : {}),
    };
    this.logs.set(id, updated);
    return Promise.resolve(updated);
  }
}

// Fake AiClient that returns canned responses per tool name. Records each
// call so the test can assert what was sent (and with what context).
function fakeAi(responses: {
  classify_document?: Result<unknown, AiError>;
  extract_economic_profile?: Result<unknown, AiError>;
}): AiClient & {
  calls: Array<{ tool: string; input: unknown; context?: AiCallContext }>;
} {
  const calls: Array<{ tool: string; input: unknown; context?: AiCallContext }> = [];
  return {
    calls,
    call: async <TInput, TOutput>(
      tool: AiToolDefinition<TInput, TOutput>,
      input: TInput,
      context?: AiCallContext,
    ): Promise<Result<TOutput, AiError>> => {
      calls.push({ tool: tool.name, input, context });
      const response =
        tool.name === "classify_document"
          ? responses.classify_document
          : responses.extract_economic_profile;
      if (!response) {
        return err(aiError("unknown", `no canned response for tool ${tool.name}`));
      }
      return response as Result<TOutput, AiError>;
    },
  };
}

function seedLog(repo: InMemoryLogRepo, overrides: Partial<IesExtractionLog> = {}): string {
  const log: IesExtractionLog = {
    id: "log-1",
    organizationId: "org-1",
    uploadedByUserId: "user-1",
    s3Key: "organizations/org-1/ies/log-1.pdf",
    s3DeletedAt: null,
    originalFilename: "IES-2024.pdf",
    fileSizeBytes: 102400,
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
    ...overrides,
  };
  repo.seed(log);
  return log.id;
}

function happyExtraction(): ExtractedEconomicProfile {
  return {
    year: { value: 2024, confidence: "HIGH" },
    employees: { value: 50, confidence: "HIGH" },
    turnover: { value: 1_500_000, confidence: "HIGH" },
    ebitda: { value: 200_000, confidence: "HIGH" },
    balanceSheetTotal: { value: 800_000, confidence: "HIGH" },
    cae: { value: "62010", confidence: "HIGH" },
  };
}

async function preloadPdf(s3: InMemoryS3Uploader, key: string): Promise<void> {
  await s3.upload({ key, body: "%PDF-fake bytes", contentType: "application/pdf" });
}

describe("IesExtractionService.runPipeline", () => {
  it("happy path — classify=ies + extract ok → status awaiting_user_confirmation", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({
      classify_document: ok({ kind: "ies", confidence: "high" }),
      extract_economic_profile: ok(happyExtraction()),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    const result = await service.runPipeline(logId, "inngest-run-abc");

    expect(result.status).toBe("awaiting_user_confirmation");
    const finalLog = await repo.findAnyById(logId);
    expect(finalLog?.status).toBe("awaiting_user_confirmation");
    expect(finalLog?.year).toBe(2024);
    expect(finalLog?.extractionResult).toEqual(happyExtraction());
    // Validator warnings array exists (likely empty for happy values).
    expect(finalLog?.validatorWarnings).toEqual([]);
  });

  it("propagates correlationId + actorUserId to both AI calls", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({
      classify_document: ok({ kind: "ies", confidence: "high" }),
      extract_economic_profile: ok(happyExtraction()),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    await service.runPipeline(logId);

    expect(ai.calls).toHaveLength(2);
    for (const call of ai.calls) {
      expect(call.context?.organizationId).toBe("org-1");
      expect(call.context?.actorUserId).toBe("user-1");
      expect(call.context?.correlationId).toBe(logId);
    }
  });

  it("classify says non-IES → status failed_not_ies and skips extract", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({
      classify_document: ok({ kind: "invoice", confidence: "high" }),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    const result = await service.runPipeline(logId);

    expect(result.status).toBe("failed_not_ies");
    const finalLog = await repo.findAnyById(logId);
    expect(finalLog?.status).toBe("failed_not_ies");
    expect(finalLog?.errorMessage).toContain("não parece ser um IES");
    expect(ai.calls).toHaveLength(1); // only classify ran
  });

  it("extract output_parse failure → status failed_extraction with parse error message", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({
      classify_document: ok({ kind: "ies", confidence: "high" }),
      extract_economic_profile: err(aiError("output_parse", "schema mismatch")),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    const result = await service.runPipeline(logId);

    expect(result.status).toBe("failed_extraction");
    const finalLog = await repo.findAnyById(logId);
    expect(finalLog?.errorMessage).toContain("entrada manual");
  });

  it("extract transient AI error → status failed_extraction with try-again message", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({
      classify_document: ok({ kind: "ies", confidence: "high" }),
      extract_economic_profile: err(aiError("transient", "529 overloaded")),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    const result = await service.runPipeline(logId);

    expect(result.status).toBe("failed_extraction");
    const finalLog = await repo.findAnyById(logId);
    expect(finalLog?.errorMessage).toContain("alguns minutos");
  });

  it("missing PDF in S3 → status failed_extraction, AI never called", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({});
    const s3 = new InMemoryS3Uploader(); // empty
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    const result = await service.runPipeline(logId);

    expect(result.status).toBe("failed_extraction");
    expect(ai.calls).toHaveLength(0);
  });

  it("seeded log without s3_key → status failed_extraction with missing-key message", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({});
    const s3 = new InMemoryS3Uploader();
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo, { s3Key: null });

    const result = await service.runPipeline(logId);

    expect(result.status).toBe("failed_extraction");
    const finalLog = await repo.findAnyById(logId);
    expect(finalLog?.errorMessage).toContain("Documento original em falta");
  });

  it("validator warnings carry through into validator_warnings field", async () => {
    const repo = new InMemoryLogRepo();
    // Year in the future — validator will flag year_future.
    const extraction = happyExtraction();
    extraction.year = { value: 2099, confidence: "HIGH" };
    const ai = fakeAi({
      classify_document: ok({ kind: "ies", confidence: "high" }),
      extract_economic_profile: ok(extraction),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    await service.runPipeline(logId);
    const finalLog = await repo.findAnyById(logId);
    const warnings = finalLog?.validatorWarnings ?? [];
    expect(warnings.map((w) => w.rule)).toContain("year_future");
    // Validator downgraded year confidence — the persisted profile reflects that.
    expect(finalLog?.extractionResult?.year.confidence).toBe("LOW");
  });

  it("transitions through extracting → terminal in update history", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({
      classify_document: ok({ kind: "ies", confidence: "high" }),
      extract_economic_profile: ok(happyExtraction()),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);

    await service.runPipeline(logId);

    const statusUpdates = repo.updates
      .map((u) => u.fields.status)
      .filter((s): s is IesExtractionStatus => typeof s === "string");
    expect(statusUpdates).toEqual(["extracting", "awaiting_user_confirmation"]);
  });
});

describe("IesExtractionService.confirm", () => {
  async function runAwaitingExtraction(
    extractionOverride?: ExtractedEconomicProfile,
  ): Promise<{
    repo: InMemoryLogRepo;
    profileRepo: InMemoryProfileRepo;
    s3: InMemoryS3Uploader;
    service: IesExtractionService;
    logId: string;
  }> {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({
      classify_document: ok({ kind: "ies", confidence: "high" }),
      extract_economic_profile: ok(extractionOverride ?? happyExtraction()),
    });
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo);
    await service.runPipeline(logId);
    return { repo, profileRepo, s3, service, logId };
  }

  it("no edits → writes profile with source=ies_extracted, marks confirmed, deletes S3", async () => {
    const { repo, profileRepo, s3, service, logId } = await runAwaitingExtraction();

    const result = await service.confirm("org-1", logId);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.source).toBe("ies_extracted");
    expect(result.profile.year).toBe(2024);
    expect(result.profile.employees).toBe(50);
    expect(profileRepo.profiles.size).toBe(1);

    const finalLog = await repo.findAnyById(logId);
    expect(finalLog?.status).toBe("confirmed");
    expect(s3.has("organizations/org-1/ies/log-1.pdf")).toBe(false);
  });

  it("with edits → source=edited_after_extraction; edits override extracted values", async () => {
    const { profileRepo, service, logId } = await runAwaitingExtraction();

    const result = await service.confirm("org-1", logId, { employees: 75, cae: "62020" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.source).toBe("edited_after_extraction");
    expect(result.profile.employees).toBe(75);
    expect(result.profile.cae).toBe("62020");
    // Non-edited fields keep the extracted value.
    expect(result.profile.turnover).toBe(1_500_000);
    expect(profileRepo.profiles.size).toBe(1);
  });

  it("rejects confirm on a log that isn't awaiting_user_confirmation", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({});
    const s3 = new InMemoryS3Uploader();
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo, { status: "failed_extraction" });

    const result = await service.confirm("org-1", logId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("wrong_status");
  });

  it("rejects confirm when no_year (extraction returned null year and no edit supplies one)", async () => {
    const noYearExtraction = happyExtraction();
    noYearExtraction.year = { value: null, confidence: "LOW" };
    const { service, logId } = await runAwaitingExtraction(noYearExtraction);

    const result = await service.confirm("org-1", logId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("no_year");
  });

  it("supplying year via edits when extraction omitted it succeeds", async () => {
    const noYearExtraction = happyExtraction();
    noYearExtraction.year = { value: null, confidence: "LOW" };
    const { service, logId } = await runAwaitingExtraction(noYearExtraction);

    const result = await service.confirm("org-1", logId, { year: 2024 });
    expect(result.ok).toBe(true);
  });

  it("rejects confirm from a different org (tenant isolation)", async () => {
    const { service, logId } = await runAwaitingExtraction();
    const result = await service.confirm("other-org", logId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("log_not_found");
  });
});

describe("IesExtractionService.cancel", () => {
  it("cancels an awaiting log: status=cancelled, S3 deleted", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({});
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo, { status: "awaiting_user_confirmation" });

    const result = await service.cancel("org-1", logId);
    expect(result.ok).toBe(true);
    const finalLog = await repo.findAnyById(logId);
    expect(finalLog?.status).toBe("cancelled");
    expect(s3.has("organizations/org-1/ies/log-1.pdf")).toBe(false);
  });

  it("cancel on terminal log → wrong_status (no S3 churn)", async () => {
    const repo = new InMemoryLogRepo();
    const ai = fakeAi({});
    const s3 = new InMemoryS3Uploader();
    await preloadPdf(s3, "organizations/org-1/ies/log-1.pdf");
    const profileRepo = new InMemoryProfileRepo();
    const service = new IesExtractionService(repo, ai, s3, profileRepo);
    const logId = seedLog(repo, { status: "confirmed" });

    const result = await service.cancel("org-1", logId);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("wrong_status");
    // S3 untouched on rejection.
    expect(s3.has("organizations/org-1/ies/log-1.pdf")).toBe(true);
  });
});

// Quiet down TypeScript about the imported but unused StorageError type;
// the tests don't trigger storage error paths, but the import documents
// that the service surface depends on storage's typed error union.
const _types: StorageError | null = null;
void _types;
