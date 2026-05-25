// CoverageService — thin orchestration. Composes the catalog repo +
// mapping repo + org's records + latest profile, then runs the pure
// CoverageCalculator.
//
// V10.3 wraps this with an AI explanation pass (returns the same
// CoverageMatrix + per-row explanations + suggested next steps). The
// deterministic surface lives here; AI is purely additive.
//
// Mapping CRUD is here too — small surface (create/delete + a global
// list for the catalog UI), wraps the repo with auth-context audit
// writes.

import type { AuditService } from "../../audit/module.js";
import type { EconomicProfileRepository } from "../../economic-profile/module.js";
import { extractCae3 } from "../../sector-benchmark/module.js";
import type { RecordRepository } from "../../records/application/record-service.js";
import type { Framework, FrameworkDatapoint } from "@bgreen/frameworks";
import { CS_WORKSPACE_ID } from "../../../auth-helpers.js";
import type { CoverageMatrix, TemplateDatapointMapping } from "../domain/types.js";
import type { FrameworkDatapointRepository } from "../infrastructure/framework-datapoint-repository.js";
import type { TemplateDatapointMappingRepository } from "../infrastructure/template-datapoint-mapping-repository.js";
import { calculateCoverage } from "./coverage-calculator.js";

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

export class CoverageService {
  constructor(
    private readonly datapoints: FrameworkDatapointRepository,
    private readonly mappings: TemplateDatapointMappingRepository,
    private readonly records: RecordRepository,
    private readonly profiles: EconomicProfileRepository,
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
