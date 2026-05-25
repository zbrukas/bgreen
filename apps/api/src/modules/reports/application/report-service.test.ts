// V11.3 — ReportService unit tests.
//
// Mirrors V9.2 + V10.3 test patterns: in-memory repos, recording
// fakes for AI / PDF / S3 / email / Inngest. Focus is on the
// composition contract:
//   - start() builds + hashes + persists pending + fires Inngest
//   - runGeneration() composes AI → PDF → S3 → email + writes audit
//   - AI failure degrades to commentary=null but still ships the PDF
//   - PDF failure marks the row failed + writes audit
//   - tenant isolation: downloadUrl from another org returns not_found

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
import { InMemoryPdfRenderer } from "@bgreen/pdf-engine";
import { InMemoryS3Uploader } from "@bgreen/storage";
import type {
  Organization,
  OrganizationSize,
  Record as ESGRecord,
  RecordTemplate,
} from "@bgreen/types";
import { describe, expect, it } from "vitest";
import { AuditService } from "../../audit/application/audit-service.js";
import type {
  AuditRepository,
} from "../../audit/application/audit-service.js";
import type { AuditEvent, NewAuditEvent } from "../../audit/domain/audit-event.js";
import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../../economic-profile/module.js";
import type { CoverageService } from "../../framework-coverage/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import type { OrganizationRepository } from "../../organizations/module.js";
import type { RecordRepository } from "../../records/application/record-service.js";
import type { SectorBenchmarkLookup } from "../../sector-benchmark/application/sector-benchmark-lookup.js";
import { isReportTemplateId } from "../domain/types.js";
import type {
  ReportCommentary,
  ReportInstance,
  ReportInstanceStatus,
  ReportTemplateId,
} from "../domain/types.js";
import type { ReportInstanceRepository } from "../infrastructure/report-instance-repository.js";
import { ReportDataBuilder } from "./report-data-builder.js";
import {
  ReportService,
  type ReportEmailRecipientLookup,
  type ReportEventSender,
  type ReportReadyEmailSender,
} from "./report-service.js";
import type {
  GenerateReportCommentaryInput,
  GenerateReportCommentaryOutput,
} from "./tools/generate-report-commentary-tool.js";

// ── In-memory test doubles ──────────────────────────────────────────

class InMemoryReportRepo implements ReportInstanceRepository {
  readonly rows = new Map<string, ReportInstance>();
  readonly updates: Array<{ id: string; fields: { [k: string]: unknown } }> = [];
  private idCounter = 0;

  insert(input: Parameters<ReportInstanceRepository["insert"]>[0]) {
    const id = `rep-${++this.idCounter}`;
    const now = new Date().toISOString();
    const row: ReportInstance = {
      id,
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      templateId: isReportTemplateId(input.templateId) ? input.templateId : "custom",
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      status: "pending",
      s3Key: null,
      inputDataHash: input.inputDataHash,
      commentary: null,
      aiInputTokens: null,
      aiOutputTokens: null,
      inngestRunId: null,
      errorMessage: null,
      startedAt: null,
      generatedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.rows.set(id, row);
    return Promise.resolve(row);
  }
  findAnyById(id: string) {
    return Promise.resolve(this.rows.get(id) ?? null);
  }
  findById(orgId: string, id: string) {
    const row = this.rows.get(id);
    if (!row || row.organizationId !== orgId) return Promise.resolve(null);
    return Promise.resolve(row);
  }
  listForOrganization(orgId: string) {
    return Promise.resolve(
      Array.from(this.rows.values())
        .filter((r) => r.organizationId === orgId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }
  update(id: string, fields: Parameters<ReportInstanceRepository["update"]>[1]) {
    this.updates.push({ id, fields: { ...fields } });
    const current = this.rows.get(id);
    if (!current) return Promise.resolve(null);
    const updated: ReportInstance = {
      ...current,
      ...(fields.status !== undefined ? { status: fields.status } : {}),
      ...(fields.s3Key !== undefined ? { s3Key: fields.s3Key } : {}),
      ...(fields.commentary !== undefined ? { commentary: fields.commentary } : {}),
      ...(fields.aiInputTokens !== undefined ? { aiInputTokens: fields.aiInputTokens } : {}),
      ...(fields.aiOutputTokens !== undefined ? { aiOutputTokens: fields.aiOutputTokens } : {}),
      ...(fields.inngestRunId !== undefined ? { inngestRunId: fields.inngestRunId } : {}),
      ...(fields.errorMessage !== undefined ? { errorMessage: fields.errorMessage } : {}),
      ...(fields.startedAt !== undefined
        ? { startedAt: fields.startedAt?.toISOString() ?? null }
        : {}),
      ...(fields.generatedAt !== undefined
        ? { generatedAt: fields.generatedAt?.toISOString() ?? null }
        : {}),
    };
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }
}

class InMemoryOrgRepo implements OrganizationRepository {
  readonly orgs = new Map<string, Organization>();
  create(): never {
    throw new Error("unused");
  }
  findById(id: string) {
    return Promise.resolve(this.orgs.get(id) ?? null);
  }
  listForUser() {
    return Promise.resolve([]);
  }
  seed(org: Organization) {
    this.orgs.set(org.id, org);
  }
}

class InMemoryProfileRepo implements EconomicProfileRepository {
  readonly profiles: OrganizationEconomicProfile[] = [];
  upsert(): never {
    throw new Error("unused");
  }
  findByOrgYear() {
    return Promise.resolve(null);
  }
  listByOrg(orgId: string) {
    return Promise.resolve(
      this.profiles.filter((p) => p.organizationId === orgId).sort((a, b) => b.year - a.year),
    );
  }
  setDimensao() {
    return Promise.resolve(null);
  }
  seed(p: OrganizationEconomicProfile) {
    this.profiles.push(p);
  }
}

class InMemoryTemplateRepo {
  readonly templates = new Map<string, RecordTemplate>();
  findById(id: string) {
    return Promise.resolve(this.templates.get(id) ?? null);
  }
}

class InMemoryRecordRepo {
  readonly records: ESGRecord[] = [];
  listForOrganization(orgId: string) {
    return Promise.resolve(this.records.filter((r) => r.organizationId === orgId));
  }
}

class StubSectorLookup implements SectorBenchmarkLookup {
  lookup() {
    return Promise.resolve({
      insufficientData: true as const,
      reason: "missing_dimensao" as const,
      cae3: null,
      dimensao: null,
      year: 0,
    });
  }
}

// Minimal CoverageService stub. ReportService only calls getMatrix
// for ESRS E1; everything else can throw if used.
function stubCoverageService(): CoverageService {
  return {
    getMatrix: async () => ({
      framework: "esrs" as const,
      rows: [],
      counts: { covered: 0, partial: 0, missing: 0, total: 0 },
    }),
  } as unknown as CoverageService;
}

class InMemoryAuditRepo implements AuditRepository {
  readonly events: AuditEvent[] = [];
  private idCounter = 0;
  insert(event: NewAuditEvent): Promise<AuditEvent> {
    const persisted: AuditEvent = {
      id: `audit-${++this.idCounter}`,
      occurredAt: new Date().toISOString(),
      actorUserId: event.actorUserId,
      organizationId: event.organizationId,
      entityKind: event.entityKind,
      entityId: event.entityId,
      action: event.action,
      payload: event.payload,
      correlationId: event.correlationId ?? null,
    };
    this.events.push(persisted);
    return Promise.resolve(persisted);
  }
  listForEntity() {
    return Promise.resolve([]);
  }
}

function fakeAi(response: Result<GenerateReportCommentaryOutput, AiError>): AiClient & {
  calls: Array<{
    tool: string;
    input: GenerateReportCommentaryInput;
    context?: AiCallContext;
  }>;
} {
  const calls: Array<{
    tool: string;
    input: GenerateReportCommentaryInput;
    context?: AiCallContext;
  }> = [];
  return {
    calls,
    call: async <TInput, TOutput>(
      tool: AiToolDefinition<TInput, TOutput>,
      input: TInput,
      context?: AiCallContext,
    ): Promise<Result<TOutput, AiError>> => {
      calls.push({
        tool: tool.name,
        input: input as unknown as GenerateReportCommentaryInput,
        context,
      });
      return response as unknown as Result<TOutput, AiError>;
    },
  };
}

class RecordingSender implements ReportEventSender {
  readonly events: Array<{ name: string; data: { reportId: string } }> = [];
  send(event: { name: "report.generation.started"; data: { reportId: string } }) {
    this.events.push(event);
    return Promise.resolve();
  }
}

class RecordingEmailSender implements ReportReadyEmailSender {
  readonly sends: Array<{
    to: string;
    organizationName: string;
    reportTitle: string;
    downloadUrl: string;
    generatedAt: string;
  }> = [];
  send(input: Parameters<ReportReadyEmailSender["send"]>[0]) {
    this.sends.push(input);
    return Promise.resolve({ delivered: true });
  }
}

class StubUserLookup implements ReportEmailRecipientLookup {
  readonly emails = new Map<string, string>();
  findEmailById(id: string) {
    return Promise.resolve(this.emails.get(id) ?? null);
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function seedOrg(repo: InMemoryOrgRepo, overrides: Partial<Organization> = {}): Organization {
  const org: Organization = {
    id: "org-1",
    workosOrganizationId: null,
    name: "ACME Energia",
    nif: null,
    caeCode: "62010",
    legalForm: null,
    selfReportedSize: null as OrganizationSize | null,
    postalCode: null,
    addressLine: null,
    freguesia: null,
    concelho: null,
    distrito: null,
    logoUrl: null,
    brandPrimaryColor: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
  repo.seed(org);
  return org;
}

function happyCommentary(): GenerateReportCommentaryOutput {
  return {
    sections: Array.from({ length: 3 }, (_, i) => ({
      title: `Secção ${i + 1}`,
      narrative:
        "Narrativa em pt-PT com pelo menos quarenta caracteres para passar a validação do schema.",
      callouts: ["Destaque 1"],
    })),
  };
}

function buildService(opts: { ai: AiClient }) {
  const reports = new InMemoryReportRepo();
  const orgs = new InMemoryOrgRepo();
  const profiles = new InMemoryProfileRepo();
  const sector = new StubSectorLookup();
  const records = new InMemoryRecordRepo();
  const templates = new InMemoryTemplateRepo();
  const coverage = stubCoverageService();
  const audit = new InMemoryAuditRepo();
  const pdf = new InMemoryPdfRenderer();
  const s3 = new InMemoryS3Uploader();
  const email = new RecordingEmailSender();
  const users = new StubUserLookup();
  const events = new RecordingSender();
  const builder = new ReportDataBuilder(
    orgs,
    profiles,
    sector,
    records as unknown as RecordRepository,
    templates as unknown as RecordTemplateRepository,
    coverage,
  );
  const service = new ReportService({
    reports,
    builder,
    ai: opts.ai,
    pdf,
    s3,
    email,
    users,
    events,
    audit: new AuditService(audit),
  });
  return {
    service,
    reports,
    orgs,
    profiles,
    records,
    audit,
    pdf,
    s3,
    email,
    users,
    events,
  };
}

// ── start() ────────────────────────────────────────────────────────

describe("ReportService.start", () => {
  it("inserts pending row + fires Inngest event + writes generate_started audit", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);

    const result = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.status).toBe("pending");
    expect(result.report.templateId).toBe("ghg-inventory");
    expect(result.report.inputDataHash).toMatch(/^[0-9a-f]{64}$/);
    expect(ctx.events.events).toHaveLength(1);
    expect(ctx.events.events[0]?.data.reportId).toBe(result.report.id);
    const startedAudit = ctx.audit.events.find((e) => e.action === "report.generate_started");
    expect(startedAudit?.entityKind).toBe("report_instance");
  });

  it("queue_failed → row marked failed when Inngest send throws", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);
    // Replace the event sender with a throwing one.
    (ctx.service as unknown as { deps: { events: ReportEventSender } }).deps.events = {
      send: () => Promise.reject(new Error("inngest down")),
    };

    const result = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "custom",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
      customTitle: "Inventário energético",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("queue_failed");
    const stored = Array.from(ctx.reports.rows.values())[0];
    expect(stored?.status).toBe("failed");
  });
});

// ── runGeneration() ────────────────────────────────────────────────

describe("ReportService.runGeneration", () => {
  it("happy path: AI ok → PDF rendered → S3 uploaded → email sent → ready", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);
    ctx.users.emails.set("user-1", "alice@example.com");

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");

    const outcome = await ctx.service.runGeneration(started.report.id, "run-abc");
    expect(outcome.status).toBe("ready");

    const final = await ctx.reports.findAnyById(started.report.id);
    expect(final?.status).toBe("ready");
    expect(final?.s3Key).toBe(`organizations/org-1/reports/${started.report.id}.pdf`);
    expect(final?.commentary?.sections).toHaveLength(3);
    expect(final?.inngestRunId).toBe("run-abc");

    expect(ctx.pdf.calls).toHaveLength(1);
    expect(ctx.pdf.calls[0]?.template).toBe("ghg-inventory");

    expect(ctx.s3.has(final?.s3Key ?? "")).toBe(true);
    expect(ctx.email.sends).toHaveLength(1);
    expect(ctx.email.sends[0]?.to).toBe("alice@example.com");

    const completedAudit = ctx.audit.events.find((e) => e.action === "report.generate_completed");
    expect(completedAudit?.entityKind).toBe("report_instance");
    expect((completedAudit?.payload as { commentarySectionCount: number }).commentarySectionCount).toBe(3);
  });

  it("AI failure → commentary=null but report still ships", async () => {
    const ai = fakeAi(err(aiError("transient", "down")));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");

    const outcome = await ctx.service.runGeneration(started.report.id);
    expect(outcome.status).toBe("ready");

    const final = await ctx.reports.findAnyById(started.report.id);
    expect(final?.commentary).toBeNull();
    expect(final?.s3Key).not.toBeNull();
  });

  it("PDF failure → status=failed + audit row", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);
    ctx.pdf.setNext(new Error("gotenberg down"));

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");

    const outcome = await ctx.service.runGeneration(started.report.id);
    expect(outcome.status).toBe("failed");

    const final = await ctx.reports.findAnyById(started.report.id);
    expect(final?.status).toBe("failed");
    expect(final?.errorMessage).toContain("Não foi possível gerar");
    const failedAudit = ctx.audit.events.find((e) => e.action === "report.generate_failed");
    expect(failedAudit).toBeDefined();
  });

  it("idempotency: re-running a terminal row is a no-op", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");

    await ctx.service.runGeneration(started.report.id);
    const second = await ctx.service.runGeneration(started.report.id);
    expect(second.status).toBe("ready");
    // Only one AI call, one PDF render.
    expect(ai.calls).toHaveLength(1);
    expect(ctx.pdf.calls).toHaveLength(1);
  });

  it("propagates entityKind=report_instance + template in AI context metadata", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "esrs-e1",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");

    await ctx.service.runGeneration(started.report.id);
    const call = ai.calls[0];
    expect((call?.context?.metadata as { entityKind: string }).entityKind).toBe(
      "report_instance",
    );
    expect((call?.context?.metadata as { template: string }).template).toBe("esrs-e1");
  });
});

// ── downloadUrl() ──────────────────────────────────────────────────

describe("ReportService.downloadUrl", () => {
  it("returns a presigned URL for a ready report + writes download audit", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");
    await ctx.service.runGeneration(started.report.id);

    const result = await ctx.service.downloadUrl({
      organizationId: "org-1",
      actorUserId: "user-2",
      reportId: started.report.id,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // InMemoryS3Uploader URL-encodes the key in its presigned URL;
    // accept either encoded or raw to keep this test stable against
    // the encoding choice.
    expect(result.url).toMatch(/organizations(?:%2F|\/)org-1(?:%2F|\/)reports/);
    const downloadAudit = ctx.audit.events.find((e) => e.action === "report.downloaded");
    expect(downloadAudit?.actorUserId).toBe("user-2");
  });

  it("not_ready when status != ready", async () => {
    const ai = fakeAi(err(aiError("transient", "down")));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");

    // Don't run the pipeline — row stays pending.
    const result = await ctx.service.downloadUrl({
      organizationId: "org-1",
      actorUserId: "user-1",
      reportId: started.report.id,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not_ready");
  });

  it("tenant isolation: requesting from another org returns not_found", async () => {
    const ai = fakeAi(ok(happyCommentary()));
    const ctx = buildService({ ai });
    seedOrg(ctx.orgs);

    const started = await ctx.service.start({
      organizationId: "org-1",
      userId: "user-1",
      template: "ghg-inventory",
      periodStart: "2025-01-01",
      periodEnd: "2025-12-31",
    });
    if (!started.ok) throw new Error("start failed");
    await ctx.service.runGeneration(started.report.id);

    const result = await ctx.service.downloadUrl({
      organizationId: "other-org",
      actorUserId: "user-1",
      reportId: started.report.id,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not_found");
  });
});

// Silence unused-status warning when expanding the test set.
const _types: ReportInstanceStatus | ReportTemplateId | ReportCommentary | null = null;
void _types;
