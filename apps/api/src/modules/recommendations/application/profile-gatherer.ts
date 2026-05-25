// ProfileGatherer — assembles the input the AI tool needs for one
// generation. Composes three data sources:
//   1. The most-recent economic profile for the org (V7.1).
//   2. The matching sector aggregate (V7.2 lookup with year-fallback).
//   3. Aggregated record counts per template + latest score (V8.2).
//
// Output:
//   - completenessSignals (fed to classifyCompleteness) — derived from
//     which data sources actually returned content.
//   - toolInput (the snapshot the AI tool expects) — everything the
//     prompt needs, with null values for fields the org hasn't filled.
//
// Side effects: none. Tenant-scoped reads via the injected repos.

import type { Organization } from "../../organizations/domain/organization.js";
import type { OrganizationRepository } from "../../organizations/module.js";
import type { OrganizationEconomicProfile } from "../../economic-profile/module.js";
import type { EconomicProfileRepository } from "../../economic-profile/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import type { RecordRepository } from "../../records/application/record-service.js";
import type { SectorBenchmarkLookup } from "../../sector-benchmark/module.js";
import {
  computeEbitdaMargin,
  extractCae3,
  isInsufficientData,
} from "../../sector-benchmark/module.js";
import type { CompletenessSignals } from "./completeness.js";
import type { GenerateRecommendationsInput } from "./tools/generate-recommendations-tool.js";

export interface ProfileSnapshot {
  signals: CompletenessSignals;
  toolInput: GenerateRecommendationsInput["profile"];
}

export class ProfileGatherer {
  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly profiles: EconomicProfileRepository,
    private readonly sector: SectorBenchmarkLookup,
    private readonly records: RecordRepository,
    private readonly templates: RecordTemplateRepository,
  ) {}

  async gather(organizationId: string): Promise<ProfileSnapshot> {
    const [org, allProfiles, allRecords] = await Promise.all([
      this.orgs.findById(organizationId),
      this.profiles.listByOrg(organizationId),
      this.records.listForOrganization(organizationId),
    ]);

    // Pick the most-recent confirmed profile to anchor the prompt.
    // listByOrg returns newest-first already; defensive sort guards
    // against future repository changes.
    const latest = allProfiles
      .slice()
      .sort((a, b) => b.year - a.year)[0] ?? null;

    const hasIes = allProfiles.some(
      (p) => p.source === "ies_extracted" || p.source === "edited_after_extraction",
    );
    const hasDimensao = latest?.dimensao !== undefined && latest?.dimensao !== null;
    // Records signal: at least one *submitted* record. Drafts don't count
    // — the V9 plan ("≥1 ESG record submitted") wants confirmed data.
    const submittedRecords = allRecords.filter((r) => r.status !== "draft");
    const hasRecords = submittedRecords.length > 0;

    const peer = latest ? await this.lookupPeer(latest) : null;

    const recordCountsByTemplate = await this.aggregateRecordsByTemplate(submittedRecords);

    const toolInput: GenerateRecommendationsInput["profile"] = {
      size: pickSize(org, latest),
      cae3: latest ? extractCae3(latest.cae) : pickCae3FromOrg(org),
      year: latest?.year ?? null,
      employees: latest?.employees ?? null,
      turnover: latest?.turnover ?? null,
      ebitda: latest?.ebitda ?? null,
      ebitdaMargin: latest ? computeEbitdaMargin(latest) : null,
      peerMedianTurnover: peer?.medianTurnover ?? null,
      peerMedianEbitdaMargin: peer?.medianEbitdaMargin ?? null,
      recordCountsByTemplate,
    };

    return {
      signals: { hasIes, hasDimensao, hasRecords },
      toolInput,
    };
  }

  private async lookupPeer(profile: OrganizationEconomicProfile) {
    const cae3 = extractCae3(profile.cae);
    if (!cae3 || !profile.dimensao) return null;
    const result = await this.sector.lookup({
      cae3,
      dimensao: profile.dimensao,
      year: profile.year,
    });
    if (isInsufficientData(result)) return null;
    return result;
  }

  private async aggregateRecordsByTemplate(
    records: import("@bgreen/types").RecordSummary[],
  ): Promise<GenerateRecommendationsInput["profile"]["recordCountsByTemplate"]> {
    if (records.length === 0) return [];
    type Group = {
      templateId: string;
      recordCount: number;
      latestSubmittedAt: string;
      latestScorePct: number | null;
      latestTier: string | null;
    };
    const byTemplate = new Map<string, Group>();
    for (const r of records) {
      const existing = byTemplate.get(r.templateId);
      const submittedAt = r.submittedAt ?? r.updatedAt;
      if (!existing) {
        byTemplate.set(r.templateId, {
          templateId: r.templateId,
          recordCount: 1,
          latestSubmittedAt: submittedAt,
          latestScorePct: r.scorePercent,
          latestTier: r.scoreTier,
        });
        continue;
      }
      existing.recordCount += 1;
      if (submittedAt > existing.latestSubmittedAt) {
        existing.latestSubmittedAt = submittedAt;
        existing.latestScorePct = r.scorePercent;
        existing.latestTier = r.scoreTier;
      }
    }
    const out: GenerateRecommendationsInput["profile"]["recordCountsByTemplate"] = [];
    for (const group of byTemplate.values()) {
      const template = await this.templates.findById(group.templateId);
      if (!template) continue;
      out.push({
        templateName: template.name,
        recordCount: group.recordCount,
        latestScorePct: group.latestScorePct,
        latestTier: group.latestTier,
      });
    }
    return out;
  }
}

function pickSize(
  org: Organization | null,
  latest: OrganizationEconomicProfile | null,
): GenerateRecommendationsInput["profile"]["size"] {
  // Confirmed dimensao wins; falls back to self-reported size from V3
  // signup wizard so INCOMPLETE-mode users still get a size band.
  const dimensao = latest?.dimensao ?? null;
  if (dimensao) return dimensao;
  return (org?.selfReportedSize ?? null) as
    | GenerateRecommendationsInput["profile"]["size"]
    | null;
}

function pickCae3FromOrg(org: Organization | null): string | null {
  // Pre-IES users have only the org's CAE from signup. Use the same
  // 3-digit prefix derivation as the sector benchmark code path.
  return extractCae3(org?.caeCode ?? null);
}
