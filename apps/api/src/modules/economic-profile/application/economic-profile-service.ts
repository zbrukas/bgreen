// EconomicProfileService — read + manual-entry surface for
// organization_economic_profiles. The IES extraction path writes profile
// rows via IesExtractionService.confirm; this service owns the "manual
// entry" fallback (PRD user story §75), the dashboard list, and (V7.1)
// the dimensao proposal + confirmation flow.

import type {
  DimensaoSource,
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../infrastructure/economic-profile-repository.js";
import {
  type ClassifyDimensaoResult,
  type Dimensao,
  classifyDimensao,
} from "./dimensao-classifier.js";

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

// V7.1 dimensao surfaces.
export type ProposeDimensaoError = "profile_not_found";
export type ProposeDimensaoResult =
  | { ok: true; year: number; proposal: ClassifyDimensaoResult; alreadyConfirmed: boolean }
  | { ok: false; error: ProposeDimensaoError };

export type ConfirmDimensaoError = "profile_not_found";
export type ConfirmDimensaoResult =
  | { ok: true; profile: OrganizationEconomicProfile }
  | { ok: false; error: ConfirmDimensaoError };

export class EconomicProfileService {
  constructor(private readonly repo: EconomicProfileRepository) {}

  // Run the deterministic classifier against the persisted profile for
  // (org, year). Does NOT mutate — the proposal is for the UI banner to
  // render; the user confirms via confirmDimensao(...). `alreadyConfirmed`
  // tells the caller the user has previously locked in a dimensao for
  // this year (UI shows "Alterar" instead of "Classificar").
  async proposeDimensao(
    organizationId: string,
    year: number,
  ): Promise<ProposeDimensaoResult> {
    const profile = await this.repo.findByOrgYear(organizationId, year);
    if (!profile) return { ok: false, error: "profile_not_found" };
    const proposal = classifyDimensao({
      employees: profile.employees,
      turnover: profile.turnover,
      balanceSheetTotal: profile.balanceSheetTotal,
    });
    return {
      ok: true,
      year,
      proposal,
      alreadyConfirmed: profile.dimensao !== null,
    };
  }

  // Persist the user's dimensao choice for (org, year). `source` tells
  // whether the user accepted the deterministic proposal as-is
  // ('ai_classified') or changed it ('user_override').
  async confirmDimensao(input: {
    organizationId: string;
    year: number;
    dimensao: Dimensao;
    source: DimensaoSource;
  }): Promise<ConfirmDimensaoResult> {
    const profile = await this.repo.findByOrgYear(input.organizationId, input.year);
    if (!profile) return { ok: false, error: "profile_not_found" };
    // We always re-run the classifier here so the persisted rationale
    // reflects the profile's current values. If the user overrode the
    // proposal, the rationale still describes WHY the deterministic
    // banding pointed elsewhere — useful audit trail.
    const proposal = classifyDimensao({
      employees: profile.employees,
      turnover: profile.turnover,
      balanceSheetTotal: profile.balanceSheetTotal,
    });
    const updated = await this.repo.setDimensao({
      organizationId: input.organizationId,
      year: input.year,
      dimensao: input.dimensao,
      source: input.source,
      rationale: proposal.rationale,
    });
    if (!updated) return { ok: false, error: "profile_not_found" };
    return { ok: true, profile: updated };
  }

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
