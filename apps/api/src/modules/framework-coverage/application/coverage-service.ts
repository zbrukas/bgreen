// CoverageService — thin orchestration. Composes the catalog repo +
// mapping repo + org's records + latest profile, then runs the pure
// CoverageCalculator. V10.3 adds the AI explanation pass via
// checkCoverage() — same deterministic matrix plus per-row pt-PT
// narrative + suggested next steps. The AI is purely additive — any
// failure still returns the bare matrix so the UI doesn't lose data.
//
// Mapping CRUD lives here too — small surface (create/delete + a
// global list for the catalog UI), wraps the repo with auth-context
// audit writes.

import type { AiClient } from "@bgreen/ai";
import type { AuditService } from "../../audit/module.js";
import type { EconomicProfileRepository } from "../../economic-profile/module.js";
import type { OrganizationRepository } from "../../organizations/module.js";
// Deep import (not the module barrel) — the barrel re-exports
// api/routes.ts which transitively loads services.ts, which loops
// back here at test-resolution time. Same workaround as V8.2 records.
import { extractCae3 } from "../../sector-benchmark/application/benchmark-comparison.js";
import type { RecordRepository } from "../../records/application/record-service.js";
import type { Framework, FrameworkDatapoint } from "@bgreen/frameworks";
import { CS_WORKSPACE_ID } from "../../../auth-helpers.js";
import type {
  CoverageMatrix,
  CoverageRow,
  TemplateDatapointMapping,
} from "../domain/types.js";
import type { FrameworkDatapointRepository } from "../infrastructure/framework-datapoint-repository.js";
import type { TemplateDatapointMappingRepository } from "../infrastructure/template-datapoint-mapping-repository.js";
import { calculateCoverage } from "./coverage-calculator.js";
import {
  type CheckFrameworkCoverageOutput,
  checkFrameworkCoverageTool,
} from "./tools/check-framework-coverage-tool.js";

// pt-PT vocabulary surfaced when the AI explanation pass fails. The
// matrix is still returned — explanations is an empty array.
const ERR_AI_TRANSIENT =
  "O serviço de IA está temporariamente indisponível. As explicações irão aparecer numa próxima tentativa.";
const ERR_AI_PARSE =
  "Não foi possível gerar explicações neste momento. A matriz de cobertura continua disponível.";

export interface CoverageQuery {
  organizationId: string;
  framework: Framework;
  // Defaults to false — non-applicable rows are dropped to keep the
  // matrix focused. The UI's "applicable to my sector only" toggle
  // off flips this to true.
  includeNonApplicable?: boolean;
}

export type MappingError = "datapoint_not_found";

export type MappingResult =
  | { ok: true; mapping: TemplateDatapointMapping }
  | { ok: false; error: MappingError };

// One per-row explanation merged onto the deterministic matrix. The
// datapointId field is the join key — the UI renders in CoverageRow
// order without an extra pass.
export interface RowExplanation {
  datapointId: string;
  explanation: string;
  suggestedNextStep: string;
}

// checkCoverage() result. The matrix is always populated; the
// explanations array is empty and aiError carries the pt-PT message
// when the AI call fails (the route still returns 200 — explanations
// are an additive surface, not the source of truth).
export interface CoverageCheckResult {
  matrix: CoverageMatrix;
  explanations: RowExplanation[];
  aiError: string | null;
}

export class CoverageService {
  constructor(
    private readonly datapoints: FrameworkDatapointRepository,
    private readonly mappings: TemplateDatapointMappingRepository,
    private readonly records: RecordRepository,
    private readonly profiles: EconomicProfileRepository,
    private readonly orgs: OrganizationRepository,
    private readonly ai: AiClient,
    private readonly audit: AuditService,
  ) {}

  async listDatapoints(framework?: Framework): Promise<FrameworkDatapoint[]> {
    if (!framework) return this.datapoints.listAll();
    return this.datapoints.listByFramework(framework);
  }

  async getMatrix(query: CoverageQuery): Promise<CoverageMatrix> {
    const [allDatapoints, allMappings, records, allProfiles] = await Promise.all([
      this.datapoints.listByFramework(query.framework),
      this.mappings.listAll(),
      this.records.listForOrganization(query.organizationId),
      this.profiles.listByOrg(query.organizationId),
    ]);

    const latestProfile = allProfiles[0] ?? null;
    const cae3 = latestProfile ? extractCae3(latestProfile.cae) : null;

    return calculateCoverage({
      framework: query.framework,
      datapoints: allDatapoints,
      mappings: allMappings,
      records: records.map((r) => ({
        id: r.id,
        templateId: r.templateId,
        status: r.status,
      })),
      cae3,
      includeNonApplicable: query.includeNonApplicable ?? false,
    });
  }

  // V10.3 — deterministic matrix + AI explanation pass. Synchronous
  // (~10s typical): the AI prompt is bounded by the matrix size
  // (≤60 rows in v1) and the output is tight (status echo + two short
  // pt-PT strings per row).
  //
  // The matrix is always returned. AI failures degrade gracefully:
  // explanations=[] + aiError carries the pt-PT message. The route
  // returns 200 in both cases — the UI surfaces aiError next to the
  // matrix.
  async checkCoverage(input: {
    organizationId: string;
    actorUserId: string;
    framework: Framework;
    includeNonApplicable?: boolean;
  }): Promise<CoverageCheckResult> {
    const matrix = await this.getMatrix({
      organizationId: input.organizationId,
      framework: input.framework,
      includeNonApplicable: input.includeNonApplicable ?? false,
    });

    // Empty matrix → skip the AI call. Common for INCOMPLETE-mode orgs
    // with no CAE-3 + the toggle on default (everything's filtered).
    if (matrix.rows.length === 0) {
      return { matrix, explanations: [], aiError: null };
    }

    // Correlation id for the AI observer + audit. Same pattern as V9
    // recommendations: a synthesized UUID so the per-AI-call audit row
    // (entityKind framework_coverage_check) and the service-level
    // audit row (action framework_coverage.check) share an entity id.
    const correlationId = crypto.randomUUID();

    const [allProfiles, org] = await Promise.all([
      this.profiles.listByOrg(input.organizationId),
      this.orgs.findById(input.organizationId),
    ]);
    const latestProfile = allProfiles[0] ?? null;

    const aiResult = await this.ai.call(
      checkFrameworkCoverageTool,
      {
        framework: input.framework,
        profile: {
          size: latestProfile?.dimensao ?? org?.selfReportedSize ?? null,
          cae3: latestProfile
            ? extractCae3(latestProfile.cae)
            : extractCae3(org?.caeCode ?? null),
          dimensao: latestProfile?.dimensao ?? null,
        },
        coverageRows: matrix.rows.map((r) => ({
          datapointId: r.datapoint.id,
          code: r.datapoint.code,
          topic: r.datapoint.topic,
          title: r.datapoint.title,
          status: r.status,
          applicable: r.applicable,
        })),
      },
      {
        organizationId: input.organizationId,
        actorUserId: input.actorUserId,
        correlationId,
        metadata: {
          feature: "framework_coverage",
          entityKind: "framework_coverage_check",
          framework: input.framework,
        },
      },
    );

    if (!aiResult.ok) {
      const message =
        aiResult.error.kind === "transient" ? ERR_AI_TRANSIENT : ERR_AI_PARSE;
      return { matrix, explanations: [], aiError: message };
    }

    const explanations = mergeAndValidate(matrix.rows, aiResult.value);

    // V10 plan §criteria: AuditLog captures coverage-check runs.
    await this.audit.record({
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      entityKind: "framework_coverage_check",
      entityId: correlationId,
      action: "framework_coverage.check",
      payload: {
        framework: input.framework,
        counts: matrix.counts,
        explanationCount: explanations.length,
      },
      correlationId,
    });

    return { matrix, explanations, aiError: null };
  }

  async listMappings(): Promise<TemplateDatapointMapping[]> {
    return this.mappings.listAll();
  }

  async addMapping(input: {
    templateId: string;
    frameworkDatapointId: string;
    actorUserId: string;
  }): Promise<MappingResult> {
    // Guard: datapoint id must exist in the catalog. Without this the
    // FK error surfaces as 500; with it the route returns 404 cleanly.
    const all = await this.datapoints.listAll();
    if (!all.some((dp) => dp.id === input.frameworkDatapointId)) {
      return { ok: false, error: "datapoint_not_found" };
    }
    const mapping = await this.mappings.insert({
      templateId: input.templateId,
      frameworkDatapointId: input.frameworkDatapointId,
      createdByUserId: input.actorUserId,
    });
    // Audit row attaches to the template (the CS-owned entity); the
    // datapoint id rides in the payload.
    await this.audit.record({
      actorUserId: input.actorUserId,
      organizationId: CS_WORKSPACE_ID,
      entityKind: "record_template",
      entityId: mapping.templateId,
      action: "record_template.datapoint_mapped",
      payload: {
        frameworkDatapointId: mapping.frameworkDatapointId,
        mappingId: mapping.id,
      },
    });
    return { ok: true, mapping };
  }

  async deleteMapping(input: {
    mappingId: string;
    actorUserId: string;
  }): Promise<TemplateDatapointMapping | null> {
    const removed = await this.mappings.deleteById(input.mappingId);
    if (!removed) return null;
    await this.audit.record({
      actorUserId: input.actorUserId,
      organizationId: CS_WORKSPACE_ID,
      entityKind: "record_template",
      entityId: removed.templateId,
      action: "record_template.datapoint_unmapped",
      payload: {
        frameworkDatapointId: removed.frameworkDatapointId,
        mappingId: removed.id,
      },
    });
    return removed;
  }
}

// Align AI explanations to deterministic matrix rows. Drops any entry
// whose status doesn't match the row (drift guard — V9.2's mode-
// mismatch pattern) or whose datapointId isn't present. Order in the
// merged array follows AI output; the route can re-order to matrix
// order if it cares, but the UI keyed render keeps them in sync.
function mergeAndValidate(
  rows: CoverageRow[],
  output: CheckFrameworkCoverageOutput,
): RowExplanation[] {
  const byDatapointId = new Map<string, CoverageRow>();
  for (const r of rows) byDatapointId.set(r.datapoint.id, r);
  const merged: RowExplanation[] = [];
  for (const e of output.explanations) {
    const row = byDatapointId.get(e.datapointId);
    if (!row) continue;
    if (row.status !== e.status) continue;
    merged.push({
      datapointId: e.datapointId,
      explanation: e.explanation,
      suggestedNextStep: e.suggestedNextStep,
    });
  }
  return merged;
}
