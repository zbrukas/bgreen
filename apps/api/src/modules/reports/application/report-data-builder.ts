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
import {
  type EmissionsExtract,
  type EmissionsSourceRow,
  extractEmissions,
  templateHasEmissions,
} from "./emissions-extractor.js";

// What a Custom report needs but no other inputs provide: a free
// title chosen at generation time. Optional everywhere else.
export interface BuildReportDataInput {
  organizationId: string;
  template: ReportTemplateId;
  periodStart: string;
  periodEnd: string;
  customTitle?: string;
}

// Rich carbon-footprint detail derived from the org's latest submitted
// emissions record. Feeds the landscape "deck" report (scope-split
// donut, KPI cards, sources table).
export interface CarbonFootprintSnapshot {
  totalTco2e: number;
  scopes: Array<{ scope: "1" | "2" | "3"; label: string; tco2e: number }>;
  sources: EmissionsSourceRow[];
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
  // Rich carbon-footprint detail, populated only for the
  // "carbon-footprint" template (extracted from the org's latest
  // submitted emissions record). Null for every other template.
  carbonFootprint: CarbonFootprintSnapshot | null;
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
    // GHG / ESRS still surface zero-stub totals (their detailed
    // emissions math lands in a later vertical). The carbon-footprint
    // template, however, extracts real totals + sources from the org's
    // latest submitted emissions record.
    let emissions = needsEmissions(input.template)
      ? {
          scope1Total: 0,
          scope2LocationTotal: 0,
          scope2MarketTotal: null as number | null,
          scope3Total: null as number | null,
        }
      : null;

    let carbonFootprint: CarbonFootprintSnapshot | null = null;
    if (input.template === "carbon-footprint") {
      const extract = await this.extractEmissions(input.organizationId, periodRecords);
      emissions = {
        scope1Total: extract?.scope1Total ?? 0,
        scope2LocationTotal: extract?.scope2LocationTotal ?? 0,
        scope2MarketTotal: extract?.scope2MarketTotal ?? null,
        scope3Total: extract?.scope3Total ?? null,
      };
      carbonFootprint = toCarbonFootprintSnapshot(extract);
    }

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
      carbonFootprint,
      coverage,
      recordCountsByTemplate,
      customTitle: input.customTitle ?? null,
    };
  }

  // Find the org's most recently submitted emissions record (across
  // any template whose schema carries the recognised emission fields)
  // and extract its scope totals + sources. Returns null when the org
  // has no such record in the period.
  private async extractEmissions(
    organizationId: string,
    periodRecords: ESGRecord[],
  ): Promise<EmissionsExtract | null> {
    const latestByTemplate = new Map<string, string>();
    for (const r of periodRecords) {
      if (r.status === "draft") continue;
      const at = r.submittedAt ?? r.updatedAt;
      const existing = latestByTemplate.get(r.templateId);
      if (!existing || at > existing) latestByTemplate.set(r.templateId, at);
    }

    let best: { extract: EmissionsExtract; at: string } | null = null;
    for (const [templateId, at] of latestByTemplate) {
      const template = await this.templates.findById(templateId);
      if (!template || !templateHasEmissions(template.formSchema)) continue;
      const record = await this.records.findLatestSubmitted(organizationId, templateId);
      if (!record) continue;
      const extract = extractEmissions(record.values, template.formSchema);
      if (!extract) continue;
      if (!best || at > best.at) best = { extract, at };
    }
    return best?.extract ?? null;
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

// Shape the extracted emissions into the carbon-footprint snapshot
// (scope-split + total + sources). Null when nothing was extracted.
function toCarbonFootprintSnapshot(
  extract: EmissionsExtract | null,
): CarbonFootprintSnapshot | null {
  if (!extract) return null;
  const scopes: CarbonFootprintSnapshot["scopes"] = [];
  if (extract.scope1Total > 0) {
    scopes.push({ scope: "1", label: "Emissões diretas", tco2e: extract.scope1Total });
  }
  if (extract.scope2LocationTotal > 0) {
    scopes.push({
      scope: "2",
      label: "Energia adquirida (localização)",
      tco2e: extract.scope2LocationTotal,
    });
  }
  if (extract.scope3Total && extract.scope3Total > 0) {
    scopes.push({ scope: "3", label: "Cadeia de valor", tco2e: extract.scope3Total });
  }
  const totalTco2e =
    extract.scope1Total + extract.scope2LocationTotal + (extract.scope3Total ?? 0);
  return { totalTco2e, scopes, sources: extract.sources };
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
