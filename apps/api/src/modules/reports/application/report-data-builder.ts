// V11.3 — ReportDataBuilder. Gathers everything needed to render
// one report:
//   - org branding (name, logo, primary color)
//   - period bounds
//   - latest economic profile + peer medians
//   - records grouped per template (counts + scores)
//   - framework-coverage matrix (ESRS E1 only)
//   - AI commentary (added by the service after the AI call)
//   - tamper-evidence hash (computed from the canonicalised collected
//     data, BEFORE commentary is added — so reruns produce the same
//     hash regardless of AI variability)
//
// Pure orchestration: composes repos that already exist. The output
// is a strongly-typed snapshot the AI tool reads + the apps/pdf
// payload composer reads.

import {
  type Framework,
  type FrameworkDatapoint,
  evaluateSectorApplicability,
} from "@bgreen/frameworks";
import type { Organization, RecordSummary as ESGRecord } from "@bgreen/types";
import type { CoverageMatrix } from "../../framework-coverage/module.js";
import type { CoverageService } from "../../framework-coverage/module.js";
import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../../economic-profile/module.js";
import type { OrganizationRepository } from "../../organizations/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import type { RecordRepository } from "../../records/application/record-service.js";
// Deep imports to avoid module barrel → services.ts loop at test
// resolution (same workaround used in V10.3).
import {
  computeEbitdaMargin,
  extractCae3,
} from "../../sector-benchmark/application/benchmark-comparison.js";
import { isInsufficientData } from "../../sector-benchmark/domain/types.js";
import type { SectorBenchmarkLookup } from "../../sector-benchmark/application/sector-benchmark-lookup.js";
import type { ReportTemplateId } from "../domain/types.js";

// What a Custom report needs but no other inputs provide: a free
// title chosen at generation time. Optional everywhere else.
export interface BuildReportDataInput {
  organizationId: string;
  template: ReportTemplateId;
  periodStart: string;
  periodEnd: string;
  customTitle?: string;
}

// Canonical snapshot used for both the AI input and the tamper hash.
// Commentary is NOT part of this object — it's a downstream AI output
// glued in by the service after hashing.
export interface ReportDataSnapshot {
  template: ReportTemplateId;
  period: { start: string; end: string };
  branding: {
    organizationId: string;
    organizationName: string;
    logoKey: string | null;
    primaryColor: string | null;
  };
  profile: {
    size: "micro" | "pequena" | "media" | "grande" | null;
    cae3: string | null;
    year: number | null;
    employees: number | null;
    turnover: number | null;
    ebitda: number | null;
    ebitdaMargin: number | null;
    peerMedianTurnover: number | null;
    peerMedianEbitdaMargin: number | null;
  };
  emissions: {
    scope1Total: number;
    scope2LocationTotal: number;
    scope2MarketTotal: number | null;
    scope3Total: number | null;
  } | null;
  coverage: CoverageMatrix | null;
  recordCountsByTemplate: Array<{
    templateName: string;
    recordCount: number;
    latestScorePct: number | null;
    latestTier: string | null;
  }>;
  customTitle: string | null;
}

export class ReportDataBuilder {
  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly profiles: EconomicProfileRepository,
    private readonly sector: SectorBenchmarkLookup,
    private readonly records: RecordRepository,
    private readonly templates: RecordTemplateRepository,
    private readonly coverage: CoverageService,
  ) {}

  async build(input: BuildReportDataInput): Promise<ReportDataSnapshot> {
    const [org, allProfiles, allRecords] = await Promise.all([
      this.orgs.findById(input.organizationId),
      this.profiles.listByOrg(input.organizationId),
      this.records.listForOrganization(input.organizationId),
    ]);

    const latest = allProfiles
      .slice()
      .sort((a, b) => b.year - a.year)[0] ?? null;

    const peer = latest ? await this.lookupPeer(latest) : null;

    const periodRecords = allRecords.filter((r) =>
      isWithinPeriod(r.submittedAt ?? r.createdAt, input.periodStart, input.periodEnd),
    );

    const recordCountsByTemplate = await this.aggregateByTemplate(periodRecords);

    // Emissions are derived from records the AI tool sees; for v1
    // we don't reach into per-record values (the form-engine path
    // varies template-by-template). Instead we surface aggregate
    // counts + leave emissions=null when the template isn't GHG/ESRS.
    // V11.4 + downstream verticals will plug real-emissions math in.
    const emissions = needsEmissions(input.template)
      ? {
          scope1Total: 0,
          scope2LocationTotal: 0,
          scope2MarketTotal: null,
          scope3Total: null,
        }
      : null;

    const coverage =
      input.template === "esrs-e1"
        ? await this.coverage.getMatrix({
            organizationId: input.organizationId,
            framework: "esrs",
            includeNonApplicable: false,
          })
        : null;

    return {
      template: input.template,
      period: { start: input.periodStart, end: input.periodEnd },
      branding: {
        organizationId: input.organizationId,
        organizationName: org?.name ?? "Organização",
        logoKey: org?.logoUrl ?? null,
        primaryColor: org?.brandPrimaryColor ?? null,
      },
      profile: {
        size: pickSize(org, latest),
        cae3: latest ? extractCae3(latest.cae) : pickCae3FromOrg(org),
        year: latest?.year ?? null,
        employees: latest?.employees ?? null,
        turnover: latest?.turnover ?? null,
        ebitda: latest?.ebitda ?? null,
        ebitdaMargin: latest ? computeEbitdaMargin(latest) : null,
        peerMedianTurnover: peer?.medianTurnover ?? null,
        peerMedianEbitdaMargin: peer?.medianEbitdaMargin ?? null,
      },
      emissions,
      coverage,
      recordCountsByTemplate,
      customTitle: input.customTitle ?? null,
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

  private async aggregateByTemplate(
    records: ESGRecord[],
  ): Promise<ReportDataSnapshot["recordCountsByTemplate"]> {
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
      if (r.status === "draft") continue;
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
    const out: ReportDataSnapshot["recordCountsByTemplate"] = [];
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

// Helpers ───────────────────────────────────────────────────────────

function needsEmissions(template: ReportTemplateId): boolean {
  return template === "ghg-inventory" || template === "esrs-e1";
}

function isWithinPeriod(
  iso: string,
  periodStart: string,
  periodEnd: string,
): boolean {
  // Compare by ISO prefix; dates round to UTC day at the boundary,
  // which is what the period selector emits.
  const d = iso.slice(0, 10);
  return d >= periodStart && d <= periodEnd;
}

function pickSize(
  org: Organization | null,
  latest: OrganizationEconomicProfile | null,
): ReportDataSnapshot["profile"]["size"] {
  const dimensao = latest?.dimensao ?? null;
  if (dimensao) return dimensao;
  return (org?.selfReportedSize ?? null) as ReportDataSnapshot["profile"]["size"];
}

function pickCae3FromOrg(org: Organization | null): string | null {
  return extractCae3(org?.caeCode ?? null);
}

// Kept exported so adjacent modules (V11.4 UI badge) can reuse the
// applicability rule without importing from @bgreen/frameworks twice.
export function isDatapointApplicable(
  dp: FrameworkDatapoint,
  cae3: string | null,
): boolean {
  return evaluateSectorApplicability(dp.sectorApplicability, cae3);
}

// Re-export Framework typing so the route layer can validate without
// pulling @bgreen/frameworks directly.
export type { Framework };
