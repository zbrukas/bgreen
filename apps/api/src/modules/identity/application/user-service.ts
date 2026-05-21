import type { CentralServicesRole, User, UserType } from "@bgreen/types";
import type { CentralServicesDomainsRepository } from "../infrastructure/central-services-domains-repository.js";

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
  ) {}

  // Called by the auth middleware on every WorkOS-validated request.
  // On first sight of a workosUserId we classify the new user by
  // matching the email against (1) GLOBAL_ADMIN_EMAIL and (2) the
  // central_services_domains table; otherwise they become an org user.
  async syncFromWorkos(input: SyncUserInput): Promise<User> {
    const existing = await this.repo.findByWorkosUserId(input.workosUserId);
    if (existing) {
      // Pass-through update — repo ignores the classification fields on
      // conflict.
      return this.repo.upsertFromWorkos({
        ...input,
        userType: existing.userType,
        centralServicesRole: existing.centralServicesRole,
      });
    }
    const classified = await this.classifyByEmail(input.email);
    return this.repo.upsertFromWorkos({ ...input, ...classified });
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
