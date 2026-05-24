import { describe, expect, it } from "vitest";
import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../infrastructure/economic-profile-repository.js";
import { EconomicProfileService } from "./economic-profile-service.js";

class InMemoryProfileRepo implements EconomicProfileRepository {
  readonly profiles = new Map<string, OrganizationEconomicProfile>();
  private key(orgId: string, year: number): string {
    return `${orgId}::${year}`;
  }
  upsert(input: Parameters<EconomicProfileRepository["upsert"]>[0]) {
    const existing = this.profiles.get(this.key(input.organizationId, input.year));
    const now = new Date().toISOString();
    const profile: OrganizationEconomicProfile = {
      id: existing?.id ?? `p-${this.profiles.size + 1}`,
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
      createdAt: existing?.createdAt ?? now,
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
      Array.from(this.profiles.values()).filter((p) => p.organizationId === orgId),
    );
  }
}

describe("EconomicProfileService.manualEntry", () => {
  it("writes a profile with source=manual and no extraction log link", async () => {
    const repo = new InMemoryProfileRepo();
    const service = new EconomicProfileService(repo);

    const result = await service.manualEntry({
      organizationId: "org-1",
      year: 2024,
      employees: 10,
      turnover: 250_000,
      ebitda: 30_000,
      balanceSheetTotal: 180_000,
      cae: "62010",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.profile.source).toBe("manual");
    expect(result.profile.iesExtractionLogId).toBeNull();
    expect(result.profile.year).toBe(2024);
  });

  it("rejects year outside [1990, 2100]", async () => {
    const repo = new InMemoryProfileRepo();
    const service = new EconomicProfileService(repo);

    const old = await service.manualEntry({
      organizationId: "org-1",
      year: 1985,
      employees: null,
      turnover: null,
      ebitda: null,
      balanceSheetTotal: null,
      cae: null,
    });
    expect(old.ok).toBe(false);
    if (old.ok) return;
    expect(old.error).toBe("invalid_year");
  });

  it("manual entry upserts existing (org, year) — second write replaces", async () => {
    const repo = new InMemoryProfileRepo();
    const service = new EconomicProfileService(repo);

    await service.manualEntry({
      organizationId: "org-1",
      year: 2024,
      employees: 10,
      turnover: 100_000,
      ebitda: 0,
      balanceSheetTotal: 50_000,
      cae: null,
    });
    const second = await service.manualEntry({
      organizationId: "org-1",
      year: 2024,
      employees: 12,
      turnover: 120_000,
      ebitda: null,
      balanceSheetTotal: null,
      cae: "62020",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.profile.employees).toBe(12);
    expect(second.profile.cae).toBe("62020");
    expect(repo.profiles.size).toBe(1);
  });

  it("list returns profiles for the given org only", async () => {
    const repo = new InMemoryProfileRepo();
    const service = new EconomicProfileService(repo);
    await service.manualEntry({
      organizationId: "org-1",
      year: 2024,
      employees: 1,
      turnover: 1,
      ebitda: 0,
      balanceSheetTotal: 1,
      cae: null,
    });
    await service.manualEntry({
      organizationId: "org-2",
      year: 2024,
      employees: 2,
      turnover: 2,
      ebitda: 0,
      balanceSheetTotal: 2,
      cae: null,
    });
    const list = await service.list("org-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.organizationId).toBe("org-1");
  });
});
