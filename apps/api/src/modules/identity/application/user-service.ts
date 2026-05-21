import type { FgaClient } from "@bgreen/auth";
import type { CentralServicesRole, User, UserType } from "@bgreen/types";
import type { CentralServicesDomainsRepository } from "../infrastructure/central-services-domains-repository.js";

// Singleton CS workspace id (mirrors apps/api/src/auth-helpers.ts).
// Kept duplicated here to avoid an import cycle through services.ts.
const CS_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export interface SyncUserInput {
  workosUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}

export interface UserRepository {
  findById(id: string): Promise<User | null>;
  findByWorkosUserId(workosUserId: string): Promise<User | null>;
  // V5.4: classification params are only applied on INSERT. Updates
  // preserve userType + centralServicesRole — that's the immutability
  // guarantee we promised in the population-split design.
  upsertFromWorkos(
    input: SyncUserInput & {
      userType: UserType;
      centralServicesRole: CentralServicesRole | null;
    },
  ): Promise<User>;
}

export class UserService {
  constructor(
    private readonly repo: UserRepository,
    private readonly csDomains: CentralServicesDomainsRepository,
    private readonly fga: FgaClient,
  ) {}

  // Called by the auth middleware on every WorkOS-validated request.
  // On first sight of a workosUserId we classify the new user by
  // matching the email against (1) GLOBAL_ADMIN_EMAIL and (2) the
  // central_services_domains table; otherwise they become an org user.
  // For CS users we also seed the matching FGA warrant so subsequent
  // privileged routes can resolve via can().
  async syncFromWorkos(input: SyncUserInput): Promise<User> {
    const existing = await this.repo.findByWorkosUserId(input.workosUserId);
    if (existing) {
      return this.repo.upsertFromWorkos({
        ...input,
        userType: existing.userType,
        centralServicesRole: existing.centralServicesRole,
      });
    }
    const classified = await this.classifyByEmail(input.email);
    const created = await this.repo.upsertFromWorkos({ ...input, ...classified });

    if (classified.userType === "central_services" && classified.centralServicesRole !== null) {
      // Mirror the population field as an FGA warrant on the CS workspace
      // so can() resolves correctly for subsequent privileged calls.
      try {
        await this.fga.writeWarrant({
          resource: {
            resourceType: "central_services_workspace",
            resourceId: CS_WORKSPACE_ID,
          },
          relation: classified.centralServicesRole,
          subject: { resourceType: "user", resourceId: created.id },
        });
      } catch (err) {
        // Don't fail user sync if FGA hiccups — log and continue. The
        // global-admin boot seed retries on next restart, and admins
        // can run `pnpm --filter @bgreen/api seed-fga` manually.
        console.warn(
          `userService.syncFromWorkos: failed to write FGA warrant for ${created.email} — ${(err as Error).message}`,
        );
      }
    }
    return created;
  }

  async getByWorkosUserId(workosUserId: string): Promise<User | null> {
    return this.repo.findByWorkosUserId(workosUserId);
  }

  // Classify a fresh sign-up. Order matters: GLOBAL_ADMIN_EMAIL wins
  // (it's a hard-coded promotion), then the domain table, then default
  // org-user.
  private async classifyByEmail(
    email: string,
  ): Promise<{ userType: UserType; centralServicesRole: CentralServicesRole | null }> {
    const normalized = email.toLowerCase();
    if (
      process.env.GLOBAL_ADMIN_EMAIL &&
      process.env.GLOBAL_ADMIN_EMAIL.toLowerCase() === normalized
    ) {
      return { userType: "central_services", centralServicesRole: "admin" };
    }
    const domain = normalized.includes("@") ? normalized.split("@")[1] : null;
    if (domain) {
      const matched = await this.csDomains.isCentralServicesDomain(domain);
      if (matched) {
        return { userType: "central_services", centralServicesRole: "maintainer" };
      }
    }
    return { userType: "organization", centralServicesRole: null };
  }
}
