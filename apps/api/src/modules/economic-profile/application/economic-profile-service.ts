// EconomicProfileService — read + manual-entry surface for
// organization_economic_profiles. The IES extraction path writes profile
// rows via IesExtractionService.confirm; this service owns the "manual
// entry" fallback (PRD user story §75) and the dashboard list.

import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../infrastructure/economic-profile-repository.js";

export interface ManualEntryInput {
  organizationId: string;
  year: number;
  employees: number | null;
  turnover: number | null;
  ebitda: number | null;
  balanceSheetTotal: number | null;
  cae: string | null;
}

export type ManualEntryError = "invalid_year";

export type ManualEntryResult =
  | { ok: true; profile: OrganizationEconomicProfile }
  | { ok: false; error: ManualEntryError };

export class EconomicProfileService {
  constructor(private readonly repo: EconomicProfileRepository) {}

  async manualEntry(input: ManualEntryInput): Promise<ManualEntryResult> {
    // Match the validator's lower bound — the route already validates
    // via zod, but defensively ensure persistence never accepts garbage.
    if (!Number.isInteger(input.year) || input.year < 1990 || input.year > 2100) {
      return { ok: false, error: "invalid_year" };
    }
    const profile = await this.repo.upsert({
      ...input,
      source: "manual",
      iesExtractionLogId: null,
    });
    return { ok: true, profile };
  }

  list(organizationId: string): Promise<OrganizationEconomicProfile[]> {
    return this.repo.listByOrg(organizationId);
  }

  findByYear(
    organizationId: string,
    year: number,
  ): Promise<OrganizationEconomicProfile | null> {
    return this.repo.findByOrgYear(organizationId, year);
  }
}
