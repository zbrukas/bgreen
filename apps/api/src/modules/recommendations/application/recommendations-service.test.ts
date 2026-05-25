// V9.2 — RecommendationsService unit tests.
//
// Covers the start() → Inngest → runGeneration() round-trip with the
// in-memory fakes mirroring V6 IES test patterns. Focus is on the
// composition contract: classification mode is what the service feeds
// the tool, AI failures map to the right pt-PT message, audit rows
// are written with the right entity kind + action.

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
import type {
  Organization,
  Record as ESGRecord,
  RecordTemplate,
  OrganizationSize,
} from "@bgreen/types";
import { describe, expect, it } from "vitest";
import type { AuditEvent, NewAuditEvent } from "../../audit/domain/audit-event.js";
import type {
  AuditRepository,
} from "../../audit/application/audit-service.js";
import { AuditService } from "../../audit/application/audit-service.js";
import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../../economic-profile/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import { InMemorySectorBenchmarkLookup } from "../../sector-benchmark/module.js";
import type { OrganizationRepository } from "../../organizations/module.js";
import type { GeneratedRecommendationRepository } from "../infrastructure/generated-recommendation-repository.js";
import type { RecommendationFeedbackRepository } from "../infrastructure/recommendation-feedback-repository.js";
import type { RecordRepository } from "../../records/application/record-service.js";
import type {
  CompletenessMode,
  GeneratedRecommendation,
  RecommendationFeedback,
  RecommendationFeedbackKind,
  RecommendationsStatus,
} from "../domain/types.js";
import type {
  GenerateRecommendationsInput,
  GenerateRecommendationsOutput,
} from "./tools/generate-recommendations-tool.js";
import {
  type RecommendationsEventSender,
  RecommendationsService,
} from "./recommendations-service.js";

// ── In-memory test doubles ──────────────────────────────────────────

class InMemoryGenerationRepo implements GeneratedRecommendationRepository {
  readonly rows = new Map<string, GeneratedRecommendation>();
  readonly updates: Array<{ id: string; fields: { [k: string]: unknown } }> = [];
  private idCounter = 0;

  insert(input: Parameters<GeneratedRecommendationRepository["insert"]>[0]) {
    const id = `gen-${++this.idCounter}`;
    const now = new Date().toISOString();
    const row: GeneratedRecommendation = {
      id,
      organizationId: input.organizationId,
      requestedByUserId: input.requestedByUserId,
      status: "pending",
      completenessMode: input.completenessMode,
      recommendations: null,
      errorMessage: null,
      aiInputTokens: null,
      aiOutputTokens: null,
      inngestRunId: null,
      startedAt: null,
      completedAt: null,
      createdAt: now,
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

  update(id: string, fields: Parameters<GeneratedRecommendationRepository["update"]>[1]) {
    this.updates.push({ id, fields: { ...fields } });
    const current = this.rows.get(id);
    if (!current) return Promise.resolve(null);
    const updated: GeneratedRecommendation = {
      ...current,
      ...(fields.status !== undefined ? { status: fields.status } : {}),
      ...(fields.recommendations !== undefined
        ? { recommendations: fields.recommendations }
        : {}),
      ...(fields.errorMessage !== undefined ? { errorMessage: fields.errorMessage } : {}),
      ...(fields.aiInputTokens !== undefined ? { aiInputTokens: fields.aiInputTokens } : {}),
      ...(fields.aiOutputTokens !== undefined ? { aiOutputTokens: fields.aiOutputTokens } : {}),
      ...(fields.inngestRunId !== undefined ? { inngestRunId: fields.inngestRunId } : {}),
      ...(fields.startedAt !== undefined
        ? { startedAt: fields.startedAt?.toISOString() ?? null }
        : {}),
      ...(fields.completedAt !== undefined
        ? { completedAt: fields.completedAt?.toISOString() ?? null }
        : {}),
    };
    this.rows.set(id, updated);
    return Promise.resolve(updated);
  }
}

class InMemoryFeedbackRepo implements RecommendationFeedbackRepository {
  private readonly rows = new Map<string, RecommendationFeedback>();
  private idCounter = 0;

  private key(genId: string, index: number, userId: string) {
    return `${genId}::${index}::${userId}`;
  }

  upsert(input: Parameters<RecommendationFeedbackRepository["upsert"]>[0]) {
    const k = this.key(input.generatedRecommendationId, input.recommendationIndex, input.userId);
    const existing = this.rows.get(k);
    const now = new Date().toISOString();
    const row: RecommendationFeedback = {
      id: existing?.id ?? `fb-${++this.idCounter}`,
      generatedRecommendationId: input.generatedRecommendationId,
      recommendationIndex: input.recommendationIndex,
      userId: input.userId,
      kind: input.kind,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.rows.set(k, row);
    return Promise.resolve(row);
  }

  listForGeneration(genId: string) {
    return Promise.resolve(Array.from(this.rows.values()).filter((r) => r.generatedRecommendationId === genId));
  }

  countsByGeneration(genId: string) {
    const counts: Partial<Record<RecommendationFeedbackKind, number>> = {};
    for (const r of this.rows.values()) {
      if (r.generatedRecommendationId !== genId) continue;
      counts[r.kind] = (counts[r.kind] ?? 0) + 1;
    }
    return Promise.resolve(counts);
  }
}

class InMemoryOrgRepo implements OrganizationRepository {
  readonly orgs = new Map<string, Organization>();

  create(): never {
    throw new Error("not used in tests — seed() directly");
  }
  findById(id: string) {
    return Promise.resolve(this.orgs.get(id) ?? null);
  }
  listForUser(): Promise<Organization[]> {
    return Promise.resolve([]);
  }
  updateBranding(): never {
    throw new Error("not used in V9 tests");
  }
  seed(org: Organization) {
    this.orgs.set(org.id, org);
  }
}

class InMemoryProfileRepo implements EconomicProfileRepository {
  readonly profiles = new Map<string, OrganizationEconomicProfile>();

  private key(orgId: string, year: number) {
    return `${orgId}::${year}`;
  }
  upsert(input: Parameters<EconomicProfileRepository["upsert"]>[0]) {
    const now = new Date().toISOString();
    const profile: OrganizationEconomicProfile = {
      id: `profile-${this.profiles.size + 1}`,
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
      dimensao: null,
      dimensaoSource: null,
      dimensaoConfirmedAt: null,
      dimensaoRationale: null,
      createdAt: now,
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
      Array.from(this.profiles.values())
        .filter((p) => p.organizationId === orgId)
        .sort((a, b) => b.year - a.year),
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
  seed(p: OrganizationEconomicProfile) {
    this.profiles.set(this.key(p.organizationId, p.year), p);
  }
}

// Partial implementation — only findById is exercised by the service.
// The cast at the construction site (`as unknown as RecordTemplateRepository`)
// keeps the surface narrow.
class InMemoryTemplateRepo {
  readonly templates = new Map<string, RecordTemplate>();
  findById(id: string) {
    return Promise.resolve(this.templates.get(id) ?? null);
  }
}

// Same pattern: V9.2 only consumes listForOrganization.
class InMemoryRecordRepo {
  readonly records: ESGRecord[] = [];
  listForOrganization(orgId: string) {
    return Promise.resolve(this.records.filter((r) => r.organizationId === orgId));
  }
}

// AuditService backed by an in-memory repo so we can assert what's
// written without spinning up Postgres.
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
  listForEntity(): Promise<AuditEvent[]> {
    return Promise.resolve([]);
  }
}

// Fake AI client returning canned responses for the generate_recommendations
// tool. Records each call's context so tests can assert mode + audit
// metadata.
function fakeAi(response: Result<GenerateRecommendationsOutput, AiError>): AiClient & {
  calls: Array<{ tool: string; input: GenerateRecommendationsInput; context?: AiCallContext }>;
} {
  const calls: Array<{ tool: string; input: GenerateRecommendationsInput; context?: AiCallContext }> = [];
  return {
    calls,
    call: async <TInput, TOutput>(
      tool: AiToolDefinition<TInput, TOutput>,
      input: TInput,
      context?: AiCallContext,
    ): Promise<Result<TOutput, AiError>> => {
      calls.push({
        tool: tool.name,
        input: input as unknown as GenerateRecommendationsInput,
        context,
      });
      return response as unknown as Result<TOutput, AiError>;
    },
  };
}

class RecordingSender implements RecommendationsEventSender {
  readonly events: Array<{ name: string; data: { generatedRecommendationId: string } }> = [];
  send(event: { name: "recommendations.generation.started"; data: { generatedRecommendationId: string } }) {
    this.events.push(event);
    return Promise.resolve();
  }
}

// ── Test helpers ────────────────────────────────────────────────────

function seedOrg(repo: InMemoryOrgRepo, overrides: Partial<Organization> = {}): Organization {
  const org: Organization = {
    id: "org-1",
    workosOrganizationId: null,
    name: "ACME",
    nif: null,
    caeCode: "62010",
    legalForm: null,
    selfReportedSize: null,
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

function seedProfile(
  repo: InMemoryProfileRepo,
  overrides: Partial<OrganizationEconomicProfile> = {},
): OrganizationEconomicProfile {
  const now = new Date().toISOString();
  const profile: OrganizationEconomicProfile = {
    id: "profile-1",
    organizationId: "org-1",
    year: 2024,
    employees: 50,
    turnover: 1_500_000,
    ebitda: 200_000,
    balanceSheetTotal: 800_000,
    cae: "62010",
    source: "ies_extracted",
    confirmedAt: now,
    iesExtractionLogId: "log-1",
    dimensao: "pequena",
    dimensaoSource: "ai_classified",
    dimensaoConfirmedAt: now,
    dimensaoRationale: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  repo.seed(profile);
  return profile;
}

function happyOutput(mode: CompletenessMode = "FULL"): GenerateRecommendationsOutput {
  return {
    completenessMode: mode,
    recommendations: Array.from({ length: 6 }, (_, i) => ({
      title: `Recomendação ${i + 1} título suficientemente longo`,
      description:
        "Descrição clara em pt-PT com pelo menos quarenta caracteres para passar a validação do schema.",
      estimatedImpact: "alto" as const,
      implementationEffort: "medio" as const,
      timeHorizon: "curto" as const,
      rationale: "Justificação plausível baseada nos dados do perfil económico fornecido.",
    })),
  };
}

function buildService(opts: {
  ai: AiClient;
  sender?: RecommendationsEventSender;
}): {
  service: RecommendationsService;
  repos: {
    gen: InMemoryGenerationRepo;
    feedback: InMemoryFeedbackRepo;
    orgs: InMemoryOrgRepo;
    profiles: InMemoryProfileRepo;
    sector: InMemorySectorBenchmarkLookup;
    records: InMemoryRecordRepo;
    templates: InMemoryTemplateRepo;
    audit: InMemoryAuditRepo;
  };
  sender: RecordingSender;
} {
  const gen = new InMemoryGenerationRepo();
  const feedback = new InMemoryFeedbackRepo();
  const orgs = new InMemoryOrgRepo();
  const profiles = new InMemoryProfileRepo();
  const sector = new InMemorySectorBenchmarkLookup();
  const records = new InMemoryRecordRepo();
  const templates = new InMemoryTemplateRepo();
  const audit = new InMemoryAuditRepo();
  const sender = (opts.sender as RecordingSender | undefined) ?? new RecordingSender();
  const service = new RecommendationsService(
    gen,
    feedback,
    opts.ai,
    new AuditService(audit),
    sender,
    {
      orgs,
      profiles,
      sector,
      records: records as unknown as RecordRepository,
      templates: templates as unknown as RecordTemplateRepository,
    },
  );
  return {
    service,
    repos: { gen, feedback, orgs, profiles, sector, records, templates, audit },
    sender,
  };
}

// ── start() ────────────────────────────────────────────────────────

describe("RecommendationsService.start", () => {
  it("classifies FULL when IES + dimensao + records, persists pending, fires event", async () => {
    const ai = fakeAi(ok(happyOutput()));
    const { service, repos, sender } = buildService({ ai });
    seedOrg(repos.orgs);
    seedProfile(repos.profiles);
    repos.records.records.push({
      id: "rec-1",
      organizationId: "org-1",
      templateId: "tpl-1",
      status: "submitted",
      values: {},
      reviewComment: null,
      submittedAt: new Date().toISOString(),
      submittedByUserId: "user-1",
      reviewedAt: null,
      reviewedByUserId: null,
      score: 80,
      scorePercent: 0.8,
      scoreTier: "Bronze",
      scoreBreakdown: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.start({ organizationId: "org-1", userId: "user-1" });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.status).toBe("pending");
    expect(result.generated.completenessMode).toBe("FULL");
    expect(sender.events).toHaveLength(1);
    expect(sender.events[0]?.data.generatedRecommendationId).toBe(result.generated.id);
  });

  it("classifies INCOMPLETE for an org with no profile + no records", async () => {
    const ai = fakeAi(ok(happyOutput("INCOMPLETE")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs, { selfReportedSize: "media" as OrganizationSize });

    const result = await service.start({ organizationId: "org-1", userId: "user-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.completenessMode).toBe("INCOMPLETE");
  });

  it("classifies PARTIAL when records exist but no IES", async () => {
    const ai = fakeAi(ok(happyOutput("PARTIAL")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);
    repos.records.records.push({
      id: "rec-1",
      organizationId: "org-1",
      templateId: "tpl-1",
      status: "submitted",
      values: {},
      reviewComment: null,
      submittedAt: new Date().toISOString(),
      submittedByUserId: "user-1",
      reviewedAt: null,
      reviewedByUserId: null,
      score: null,
      scorePercent: null,
      scoreTier: null,
      scoreBreakdown: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const result = await service.start({ organizationId: "org-1", userId: "user-1" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.generated.completenessMode).toBe("PARTIAL");
  });

  it("queue_failed marks the row failed when sender throws", async () => {
    const ai = fakeAi(ok(happyOutput()));
    const failingSender: RecommendationsEventSender = {
      send: () => Promise.reject(new Error("inngest down")),
    };
    const { service, repos } = buildService({ ai, sender: failingSender });
    seedOrg(repos.orgs);

    const result = await service.start({ organizationId: "org-1", userId: "user-1" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.kind).toBe("queue_failed");
    // The single inserted row should now be failed.
    const stored = Array.from(repos.gen.rows.values())[0];
    expect(stored?.status).toBe("failed");
  });
});

// ── runGeneration() ────────────────────────────────────────────────

describe("RecommendationsService.runGeneration", () => {
  it("happy path: AI returns 6 recs → status=ready, audit row written", async () => {
    const ai = fakeAi(ok(happyOutput("FULL")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);
    seedProfile(repos.profiles);
    repos.records.records.push({
      id: "rec-1",
      organizationId: "org-1",
      templateId: "tpl-1",
      status: "submitted",
      values: {},
      reviewComment: null,
      submittedAt: new Date().toISOString(),
      submittedByUserId: "user-1",
      reviewedAt: null,
      reviewedByUserId: null,
      score: null,
      scorePercent: null,
      scoreTier: null,
      scoreBreakdown: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const start = await service.start({ organizationId: "org-1", userId: "user-1" });
    expect(start.ok).toBe(true);
    if (!start.ok) return;

    const result = await service.runGeneration(start.generated.id, "run-abc");
    expect(result.status).toBe("ready");

    const finalRow = await repos.gen.findAnyById(start.generated.id);
    expect(finalRow?.status).toBe("ready");
    expect(finalRow?.recommendations).toHaveLength(6);
    expect(finalRow?.inngestRunId).toBe("run-abc");

    const generateEvent = repos.audit.events.find((e) => e.action === "recommendations.generate");
    expect(generateEvent).toBeDefined();
    expect(generateEvent?.entityKind).toBe("generated_recommendation");
    expect((generateEvent?.payload as { completenessMode: string }).completenessMode).toBe("FULL");
    expect((generateEvent?.payload as { recommendationCount: number }).recommendationCount).toBe(6);
  });

  it("transient AI error → status=failed with pt-PT try-again message", async () => {
    const ai = fakeAi(err(aiError("transient", "529 overloaded")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);

    const start = await service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");

    const result = await service.runGeneration(start.generated.id);
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("alguns minutos");
  });

  it("output_parse AI error → status=failed with try-again-later message", async () => {
    const ai = fakeAi(err(aiError("output_parse", "schema mismatch")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);

    const start = await service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");

    const result = await service.runGeneration(start.generated.id);
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("Tente novamente");
  });

  it("AI echoes mismatched mode → status=failed with unexpected-response message", async () => {
    // Service classifies INCOMPLETE (no profile, no records) but AI
    // returns FULL → treat as parse-class failure.
    const ai = fakeAi(ok(happyOutput("FULL")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);

    const start = await service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");
    expect(start.generated.completenessMode).toBe("INCOMPLETE");

    const result = await service.runGeneration(start.generated.id);
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toContain("inesperada");
  });

  it("propagates completenessMode + entityKind in the AI call context", async () => {
    const ai = fakeAi(ok(happyOutput("FULL")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);
    seedProfile(repos.profiles);
    repos.records.records.push({
      id: "rec-1",
      organizationId: "org-1",
      templateId: "tpl-1",
      status: "submitted",
      values: {},
      reviewComment: null,
      submittedAt: new Date().toISOString(),
      submittedByUserId: "user-1",
      reviewedAt: null,
      reviewedByUserId: null,
      score: null,
      scorePercent: null,
      scoreTier: null,
      scoreBreakdown: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const start = await service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");
    await service.runGeneration(start.generated.id);

    expect(ai.calls).toHaveLength(1);
    const call = ai.calls[0];
    expect(call?.context?.organizationId).toBe("org-1");
    expect(call?.context?.actorUserId).toBe("user-1");
    expect(call?.context?.correlationId).toBe(start.generated.id);
    expect((call?.context?.metadata as { entityKind: string }).entityKind).toBe(
      "generated_recommendation",
    );
    expect((call?.context?.metadata as { completenessMode: CompletenessMode }).completenessMode).toBe(
      "FULL",
    );
    expect(call?.input.completenessMode).toBe("FULL");
  });

  it("idempotency: a second runGeneration on a terminal row is a no-op", async () => {
    const ai = fakeAi(ok(happyOutput("FULL")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);
    seedProfile(repos.profiles);
    repos.records.records.push({
      id: "rec-1",
      organizationId: "org-1",
      templateId: "tpl-1",
      status: "submitted",
      values: {},
      reviewComment: null,
      submittedAt: new Date().toISOString(),
      submittedByUserId: "user-1",
      reviewedAt: null,
      reviewedByUserId: null,
      score: null,
      scorePercent: null,
      scoreTier: null,
      scoreBreakdown: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const start = await service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");

    const first = await service.runGeneration(start.generated.id);
    expect(first.status).toBe("ready");

    const second = await service.runGeneration(start.generated.id);
    expect(second.status).toBe("ready");
    // Only one AI call should have happened.
    expect(ai.calls).toHaveLength(1);
  });
});

// ── recordFeedback() ───────────────────────────────────────────────

describe("RecommendationsService.recordFeedback", () => {
  async function runHappy() {
    const ai = fakeAi(ok(happyOutput("FULL")));
    const ctx = buildService({ ai });
    seedOrg(ctx.repos.orgs);
    seedProfile(ctx.repos.profiles);
    // Submitted record → completeness lands at FULL, matching the AI
    // echo. Without this we'd be PARTIAL and the mode-mismatch guard
    // would fail the run.
    ctx.repos.records.records.push({
      id: "rec-1",
      organizationId: "org-1",
      templateId: "tpl-1",
      status: "submitted",
      values: {},
      reviewComment: null,
      submittedAt: new Date().toISOString(),
      submittedByUserId: "user-1",
      reviewedAt: null,
      reviewedByUserId: null,
      score: null,
      scorePercent: null,
      scoreTier: null,
      scoreBreakdown: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const start = await ctx.service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");
    await ctx.service.runGeneration(start.generated.id);
    return { ...ctx, generationId: start.generated.id };
  }

  it("first feedback inserts; switching kind updates the same row", async () => {
    const { service, repos, generationId } = await runHappy();

    const first = await service.recordFeedback({
      organizationId: "org-1",
      userId: "user-1",
      generationId,
      recommendationIndex: 0,
      kind: "util",
    });
    expect(first.ok).toBe(true);

    const switched = await service.recordFeedback({
      organizationId: "org-1",
      userId: "user-1",
      generationId,
      recommendationIndex: 0,
      kind: "ja_implementada",
    });
    expect(switched.ok).toBe(true);

    const all = await repos.feedback.listForGeneration(generationId);
    expect(all).toHaveLength(1);
    expect(all[0]?.kind).toBe("ja_implementada");
  });

  it("rejects out-of-range index", async () => {
    const { service, generationId } = await runHappy();
    const result = await service.recordFeedback({
      organizationId: "org-1",
      userId: "user-1",
      generationId,
      recommendationIndex: 99,
      kind: "util",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("out_of_range");
  });

  it("rejects feedback on non-ready generation", async () => {
    const ai = fakeAi(err(aiError("transient", "down")));
    const ctx = buildService({ ai });
    seedOrg(ctx.repos.orgs);
    const start = await ctx.service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");
    await ctx.service.runGeneration(start.generated.id);

    const result = await ctx.service.recordFeedback({
      organizationId: "org-1",
      userId: "user-1",
      generationId: start.generated.id,
      recommendationIndex: 0,
      kind: "util",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("not_ready");
  });

  it("tenant-isolation: feedback against another org's generation → generation_not_found", async () => {
    const { service, generationId } = await runHappy();
    const result = await service.recordFeedback({
      organizationId: "other-org",
      userId: "user-1",
      generationId,
      recommendationIndex: 0,
      kind: "util",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("generation_not_found");
  });

  it("writes one audit row per feedback (upsert switches still audit)", async () => {
    const { service, repos, generationId } = await runHappy();
    await service.recordFeedback({
      organizationId: "org-1",
      userId: "user-1",
      generationId,
      recommendationIndex: 0,
      kind: "util",
    });
    await service.recordFeedback({
      organizationId: "org-1",
      userId: "user-1",
      generationId,
      recommendationIndex: 0,
      kind: "ja_implementada",
    });
    const feedbackEvents = repos.audit.events.filter((e) => e.action === "recommendations.feedback");
    expect(feedbackEvents).toHaveLength(2);
  });
});

// ── listHistory() ──────────────────────────────────────────────────

describe("RecommendationsService.listHistory", () => {
  it("returns one entry per generation with aggregate feedback counts", async () => {
    const ai = fakeAi(ok(happyOutput("FULL")));
    const { service, repos } = buildService({ ai });
    seedOrg(repos.orgs);
    seedProfile(repos.profiles);
    repos.records.records.push({
      id: "rec-1",
      organizationId: "org-1",
      templateId: "tpl-1",
      status: "submitted",
      values: {},
      reviewComment: null,
      submittedAt: new Date().toISOString(),
      submittedByUserId: "user-1",
      reviewedAt: null,
      reviewedByUserId: null,
      score: null,
      scorePercent: null,
      scoreTier: null,
      scoreBreakdown: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const start = await service.start({ organizationId: "org-1", userId: "user-1" });
    if (!start.ok) throw new Error("start failed");
    await service.runGeneration(start.generated.id);

    await service.recordFeedback({
      organizationId: "org-1",
      userId: "user-1",
      generationId: start.generated.id,
      recommendationIndex: 0,
      kind: "util",
    });
    await service.recordFeedback({
      organizationId: "org-1",
      userId: "user-2",
      generationId: start.generated.id,
      recommendationIndex: 1,
      kind: "util",
    });

    const history = await service.listHistory("org-1");
    expect(history).toHaveLength(1);
    expect(history[0]?.feedbackCounts.util).toBe(2);
  });
});

// Silence unused-status warnings when expanding the test set.
const _types: RecommendationsStatus | null = null;
void _types;
