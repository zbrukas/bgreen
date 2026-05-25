import { db, orgScope, schema } from "@bgreen/db";
import { and, desc, eq } from "drizzle-orm";
import type {
  Dimensao,
  DimensaoRuleEntry,
} from "../application/dimensao-classifier.js";

export type DimensaoSource = "ai_classified" | "user_override" | "manual_entry";

// Domain shape of one organization_economic_profiles row, decoded from
// Drizzle's numeric-as-string into plain numbers for the JSON surface.
// Null fields survive — partial confirmation is allowed (the validator
// + UI flag missing required values; persistence doesn't reject them).
export interface OrganizationEconomicProfile {
  id: string;
  organizationId: string;
  year: number;
  employees: number | null;
  turnover: number | null;
  ebitda: number | null;
  balanceSheetTotal: number | null;
  cae: string | null;
  source: "ies_extracted" | "manual" | "edited_after_extraction";
  confirmedAt: string;
  iesExtractionLogId: string | null;
  // V7.1 size classification. All null until the user confirms a
  // dimensao for this year. Once set, V6 extraction confirms do not
  // overwrite (the upsert path leaves these columns alone).
  dimensao: Dimensao | null;
  dimensaoSource: DimensaoSource | null;
  dimensaoConfirmedAt: string | null;
  dimensaoRationale: DimensaoRuleEntry[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface EconomicProfileRepository {
  // Upsert on (organizationId, year). Returns the persisted row.
  upsert(input: {
    organizationId: string;
    year: number;
    employees: number | null;
    turnover: number | null;
    ebitda: number | null;
    balanceSheetTotal: number | null;
    cae: string | null;
    source: "ies_extracted" | "manual" | "edited_after_extraction";
    iesExtractionLogId: string | null;
  }): Promise<OrganizationEconomicProfile>;

  findByOrgYear(
    organizationId: string,
    year: number,
  ): Promise<OrganizationEconomicProfile | null>;

  listByOrg(organizationId: string): Promise<OrganizationEconomicProfile[]>;

  // V7.1: persist the user's dimensao decision for one year. Idempotent
  // — subsequent confirmations overwrite the prior choice (the user can
  // revisit and change). The upsert path leaves these columns alone so
  // re-extraction never silently overwrites a confirmed dimensao.
  setDimensao(input: {
    organizationId: string;
    year: number;
    dimensao: Dimensao;
    source: DimensaoSource;
    rationale: DimensaoRuleEntry[];
  }): Promise<OrganizationEconomicProfile | null>;
}

type Row = typeof schema.organizationEconomicProfiles.$inferSelect;

// Drizzle returns numeric columns as strings (preserves precision on
// €-billion values). Decode at the repo boundary so the rest of the
// app sees numbers. parseFloat is correct here — values are within
// JS-number precision (53 bits), and the validator already flags the
// implausible-margin and out-of-range cases.
function parseMoney(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToProfile(row: Row): OrganizationEconomicProfile {
  return {
    id: row.id,
    organizationId: row.organizationId,
    year: row.year,
    employees: row.employees,
    turnover: parseMoney(row.turnover),
    ebitda: parseMoney(row.ebitda),
    balanceSheetTotal: parseMoney(row.balanceSheetTotal),
    cae: row.cae,
    source: row.source,
    confirmedAt: row.confirmedAt.toISOString(),
    iesExtractionLogId: row.iesExtractionLogId,
    dimensao: row.dimensao,
    dimensaoSource: row.dimensaoSource,
    dimensaoConfirmedAt: row.dimensaoConfirmedAt
      ? row.dimensaoConfirmedAt.toISOString()
      : null,
    dimensaoRationale: row.dimensaoRationale as DimensaoRuleEntry[] | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// numeric(20,2) columns accept JS numbers as input (Drizzle stringifies
// them); kept as a helper to make the intent explicit at call sites.
function moneyToInsert(value: number | null): string | null {
  return value === null ? null : value.toFixed(2);
}

export class DrizzleEconomicProfileRepository implements EconomicProfileRepository {
  async upsert(input: {
    organizationId: string;
    year: number;
    employees: number | null;
    turnover: number | null;
    ebitda: number | null;
    balanceSheetTotal: number | null;
    cae: string | null;
    source: "ies_extracted" | "manual" | "edited_after_extraction";
    iesExtractionLogId: string | null;
  }): Promise<OrganizationEconomicProfile> {
    // ON CONFLICT (organization_id, year) — defined as
    // org_econ_profile_org_year_unique in migration 0014. Updates every
    // field except createdAt; bumps updatedAt + confirmedAt explicitly.
    const now = new Date();
    const [row] = await db
      .insert(schema.organizationEconomicProfiles)
      .values({
        organizationId: input.organizationId,
        year: input.year,
        employees: input.employees,
        turnover: moneyToInsert(input.turnover),
        ebitda: moneyToInsert(input.ebitda),
        balanceSheetTotal: moneyToInsert(input.balanceSheetTotal),
        cae: input.cae,
        source: input.source,
        iesExtractionLogId: input.iesExtractionLogId,
        confirmedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          schema.organizationEconomicProfiles.organizationId,
          schema.organizationEconomicProfiles.year,
        ],
        set: {
          employees: input.employees,
          turnover: moneyToInsert(input.turnover),
          ebitda: moneyToInsert(input.ebitda),
          balanceSheetTotal: moneyToInsert(input.balanceSheetTotal),
          cae: input.cae,
          source: input.source,
          iesExtractionLogId: input.iesExtractionLogId,
          confirmedAt: now,
          updatedAt: now,
        },
      })
      .returning();
    if (!row) throw new Error("upsert organization_economic_profiles: empty returning()");
    return rowToProfile(row);
  }

  async findByOrgYear(
    organizationId: string,
    year: number,
  ): Promise<OrganizationEconomicProfile | null> {
    const rows = await db
      .select()
      .from(schema.organizationEconomicProfiles)
      .where(
        and(
          orgScope(schema.organizationEconomicProfiles, organizationId),
          eq(schema.organizationEconomicProfiles.year, year),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToProfile(row) : null;
  }

  async listByOrg(organizationId: string): Promise<OrganizationEconomicProfile[]> {
    const rows = await db
      .select()
      .from(schema.organizationEconomicProfiles)
      .where(orgScope(schema.organizationEconomicProfiles, organizationId))
      // Newest year first — dashboards want the most recent on top.
      .orderBy(desc(schema.organizationEconomicProfiles.year));
    return rows.map(rowToProfile);
  }

  async setDimensao(input: {
    organizationId: string;
    year: number;
    dimensao: Dimensao;
    source: DimensaoSource;
    rationale: DimensaoRuleEntry[];
  }): Promise<OrganizationEconomicProfile | null> {
    const now = new Date();
    const [row] = await db
      .update(schema.organizationEconomicProfiles)
      .set({
        dimensao: input.dimensao,
        dimensaoSource: input.source,
        dimensaoConfirmedAt: now,
        dimensaoRationale: input.rationale,
        updatedAt: now,
      })
      .where(
        and(
          orgScope(schema.organizationEconomicProfiles, input.organizationId),
          eq(schema.organizationEconomicProfiles.year, input.year),
        ),
      )
      .returning();
    return row ? rowToProfile(row) : null;
  }
}
