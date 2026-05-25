// V10.3 — CoverageService.checkCoverage tests.
//
// Covers the AI explanation pass: happy-path merge, drift guard
// (mismatched status drops the explanation), tenant audit, empty-
// matrix short-circuit, transient + parse failures degrade
// gracefully (matrix returned, aiError surfaced).

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
import type { Framework } from "@bgreen/frameworks";
import { ESRS_E1_DATAPOINTS } from "@bgreen/frameworks";
import type { Organization } from "@bgreen/types";
import { describe, expect, it } from "vitest";
import type { AuditEvent, NewAuditEvent } from "../../audit/domain/audit-event.js";
import type { AuditRepository } from "../../audit/application/audit-service.js";
import { AuditService } from "../../audit/application/audit-service.js";
import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../../economic-profile/module.js";
import type { OrganizationRepository } from "../../organizations/module.js";
import type { RecordRepository } from "../../records/application/record-service.js";
import type { TemplateDatapointMapping } from "../domain/types.js";
import type { FrameworkDatapointRepository } from "../infrastructure/framework-datapoint-repository.js";
import type { TemplateDatapointMappingRepository } from "../infrastructure/template-datapoint-mapping-repository.js";
import { CoverageService } from "./coverage-service.js";
import type {
  CheckFrameworkCoverageInput,
  CheckFrameworkCoverageOutput,
} from "./tools/check-framework-coverage-tool.js";

// ── In-memory test doubles ──────────────────────────────────────────

class StubDatapointRepo implements FrameworkDatapointRepository {
  // Use a slice of the real catalog so the AI prompt input is shaped
  // identically to production. 4 rows is enough to exercise the
  // merge logic without making the explanation array unwieldy.
  private readonly rows = ESRS_E1_DATAPOINTS.slice(0, 4);
  listAll() {
    return Promise.resolve([...this.rows]);
  }
  listByFramework(framework: Framework) {
    return Promise.resolve(this.rows.filter((d) => d.framework === framework));
  }
}

class StubMappingRepo implements TemplateDatapointMappingRepository {
  private rows: TemplateDatapointMapping[] = [];
  seed(m: TemplateDatapointMapping) {
    this.rows.push(m);
  }
  insert(): never {
    throw new Error("unused in checkCoverage tests");
  }
  deleteById(): never {
    throw new Error("unused in checkCoverage tests");
  }
  findById() {
    return Promise.resolve(null);
  }
  findByPair() {
    return Promise.resolve(null);
  }
  listAll() {
    return Promise.resolve([...this.rows]);
  }
}

class StubRecordRepo {
  records: Array<{ id: string; organizationId: string; templateId: string; status: string }> = [];
  listForOrganization(orgId: string) {
    return Promise.resolve(
      this.records.filter((r) => r.organizationId === orgId) as unknown as Awaited<
        ReturnType<RecordRepository["listForOrganization"]>
      >,
    );
  }
}

class StubProfileRepo implements EconomicProfileRepository {
  profiles: OrganizationEconomicProfile[] = [];
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
}

class StubOrgRepo implements OrganizationRepository {
  orgs: Organization[] = [];
  create(): never {
    throw new Error("unused");
  }
  findById(id: string) {
    return Promise.resolve(this.orgs.find((o) => o.id === id) ?? null);
  }
  listForUser() {
    return Promise.resolve([]);
  }
  updateBranding(): never {
    throw new Error("unused");
  }
}

class StubAuditRepo implements AuditRepository {
  events: AuditEvent[] = [];
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

// Fake AI client that returns a canned response for the
// check_framework_coverage tool. Records each call so tests can assert
// on the prompt input + audit context.
function fakeAi(
  response: Result<CheckFrameworkCoverageOutput, AiError>,
): AiClient & {
  calls: Array<{
    tool: string;
    input: CheckFrameworkCoverageInput;
    context?: AiCallContext;
  }>;
} {
  const calls: Array<{
    tool: string;
    input: CheckFrameworkCoverageInput;
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
        input: input as unknown as CheckFrameworkCoverageInput,
        context,
      });
      return response as unknown as Result<TOutput, AiError>;
    },
  };
}

// ── Helpers ────────────────────────────────────────────────────────

function buildService(ai: AiClient) {
  const datapoints = new StubDatapointRepo();
  const mappings = new StubMappingRepo();
  const records = new StubRecordRepo();
  const profiles = new StubProfileRepo();
  const orgs = new StubOrgRepo();
  const audit = new StubAuditRepo();
  const service = new CoverageService(
    datapoints,
    mappings,
    records as unknown as RecordRepository,
    profiles,
    orgs,
    ai,
    new AuditService(audit),
  );
  return { service, datapoints, mappings, records, profiles, orgs, audit };
}

function seedOrg(repo: StubOrgRepo, overrides: Partial<Organization> = {}) {
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
  repo.orgs.push(org);
  return org;
}

function seedProfile(repo: StubProfileRepo, overrides: Partial<OrganizationEconomicProfile> = {}) {
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
    iesExtractionLogId: null,
    dimensao: "pequena",
    dimensaoSource: "ai_classified",
    dimensaoConfirmedAt: now,
    dimensaoRationale: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  repo.profiles.push(profile);
  return profile;
}

// Crafts a canned AI response in the shape the merger expects. Pass
// per-datapoint overrides for status drift tests.
function aiResponseFor(
  matrixRows: Array<{ datapointId: string; status: "covered" | "partial" | "missing" }>,
): CheckFrameworkCoverageOutput {
  return {
    explanations: matrixRows.map((r) => ({
      datapointId: r.datapointId,
      status: r.status,
      explanation:
        "Explicação em pt-PT com pelo menos trinta caracteres para validar o schema.",
      suggestedNextStep:
        "Próximo passo concreto e accionável com pelo menos vinte caracteres.",
    })),
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe("CoverageService.checkCoverage", () => {
  it("happy path: deterministic matrix + merged explanations + audit row", async () => {
    // Build a matrix where the first datapoint is "partial" (mapped
    // but no records) and the others are "missing".
    const matrixRows: Array<{
      datapointId: string;
      status: "covered" | "partial" | "missing";
    }> = ESRS_E1_DATAPOINTS.slice(0, 4).map((dp, i) => ({
      datapointId: dp.id,
      status: i === 0 ? "partial" : "missing",
    }));
    const ai = fakeAi(ok(aiResponseFor(matrixRows)));
    const ctx = buildService(ai);
    seedOrg(ctx.orgs);
    seedProfile(ctx.profiles);
    ctx.mappings.seed({
      id: "mapping-1",
      templateId: "tpl-energy",
      frameworkDatapointId: ESRS_E1_DATAPOINTS[0]?.id ?? "",
      createdByUserId: "user-1",
      createdAt: new Date().toISOString(),
    });

    const result = await ctx.service.checkCoverage({
      organizationId: "org-1",
      actorUserId: "user-1",
      framework: "esrs",
    });

    expect(result.matrix.framework).toBe("esrs");
    expect(result.matrix.rows.length).toBeGreaterThan(0);
    expect(result.aiError).toBeNull();
    expect(result.explanations.length).toBe(result.matrix.rows.length);
    // Audit row tagged framework_coverage_check.
    const generationAudit = ctx.audit.events.find((e) => e.action === "framework_coverage.check");
    expect(generationAudit?.entityKind).toBe("framework_coverage_check");
    expect((generationAudit?.payload as { framework: string }).framework).toBe("esrs");
  });

  it("propagates framework + entityKind in the AI call context", async () => {
    const matrixRows = ESRS_E1_DATAPOINTS.slice(0, 4).map((dp) => ({
      datapointId: dp.id,
      status: "missing" as const,
    }));
    const ai = fakeAi(ok(aiResponseFor(matrixRows)));
    const ctx = buildService(ai);
    seedOrg(ctx.orgs);
    seedProfile(ctx.profiles);

    await ctx.service.checkCoverage({
      organizationId: "org-1",
      actorUserId: "user-1",
      framework: "esrs",
    });

    expect(ai.calls).toHaveLength(1);
    const call = ai.calls[0];
    expect(call?.context?.organizationId).toBe("org-1");
    expect(call?.context?.actorUserId).toBe("user-1");
    expect((call?.context?.metadata as { entityKind: string }).entityKind).toBe(
      "framework_coverage_check",
    );
    expect((call?.context?.metadata as { framework: string }).framework).toBe("esrs");
    expect(call?.input.framework).toBe("esrs");
  });

  it("drift guard: drops explanations whose status disagrees with the matrix", async () => {
    // Service computes "missing" (no mappings), but AI echoes "covered"
    // for the first row. The merger must drop that entry.
    const matrixRows = ESRS_E1_DATAPOINTS.slice(0, 4).map((dp, i) => ({
      datapointId: dp.id,
      // First row drifted; rest match.
      status: (i === 0 ? "covered" : "missing") as "covered" | "missing",
    }));
    const ai = fakeAi(ok(aiResponseFor(matrixRows)));
    const ctx = buildService(ai);
    seedOrg(ctx.orgs);
    seedProfile(ctx.profiles);

    const result = await ctx.service.checkCoverage({
      organizationId: "org-1",
      actorUserId: "user-1",
      framework: "esrs",
    });

    // 4 rows in matrix, 4 in AI output, but 1 dropped on drift = 3.
    expect(result.matrix.rows).toHaveLength(4);
    expect(result.explanations).toHaveLength(3);
    // Confirm the drifted row is the one filtered out.
    const drifted = ESRS_E1_DATAPOINTS[0]?.id;
    expect(result.explanations.some((e) => e.datapointId === drifted)).toBe(false);
  });

  it("empty matrix short-circuits: no AI call, no audit, no aiError", async () => {
    // org with no profile → cae3=null → all 4 stub datapoints are
    // "all" applicability so still in the matrix. Force empty by
    // requesting a framework the catalog has no rows for.
    const ai = fakeAi(ok({ explanations: [] }));
    const ctx = buildService(ai);
    seedOrg(ctx.orgs);

    const result = await ctx.service.checkCoverage({
      organizationId: "org-1",
      actorUserId: "user-1",
      // Stub repo only ships ESRS rows; ghg returns []
      framework: "ghg",
    });

    expect(result.matrix.rows).toHaveLength(0);
    expect(result.explanations).toEqual([]);
    expect(result.aiError).toBeNull();
    expect(ai.calls).toHaveLength(0);
    expect(ctx.audit.events).toHaveLength(0);
  });

  it("transient AI error → aiError surfaces try-again message; matrix still returned", async () => {
    const ai = fakeAi(err(aiError("transient", "529 overloaded")));
    const ctx = buildService(ai);
    seedOrg(ctx.orgs);
    seedProfile(ctx.profiles);

    const result = await ctx.service.checkCoverage({
      organizationId: "org-1",
      actorUserId: "user-1",
      framework: "esrs",
    });

    expect(result.matrix.rows.length).toBeGreaterThan(0);
    expect(result.explanations).toEqual([]);
    expect(result.aiError).toContain("próxima tentativa");
    // No service-level audit on AI failure; per-call observer in
    // production handles the AI error, but here our stub AI bypasses it.
    expect(ctx.audit.events.some((e) => e.action === "framework_coverage.check")).toBe(false);
  });

  it("parse AI error → aiError surfaces matrix-still-available copy", async () => {
    const ai = fakeAi(err(aiError("output_parse", "schema mismatch")));
    const ctx = buildService(ai);
    seedOrg(ctx.orgs);
    seedProfile(ctx.profiles);

    const result = await ctx.service.checkCoverage({
      organizationId: "org-1",
      actorUserId: "user-1",
      framework: "esrs",
    });

    expect(result.matrix.rows.length).toBeGreaterThan(0);
    expect(result.aiError).toContain("matriz");
  });
});
