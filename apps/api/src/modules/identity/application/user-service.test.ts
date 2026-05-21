import type { CentralServicesRole, User, UserType } from "@bgreen/types";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CentralServicesDomainsRepository } from "../infrastructure/central-services-domains-repository.js";
import { type SyncUserInput, type UserRepository, UserService } from "./user-service.js";

function makeUser(over: Partial<User> = {}): User {
  return {
    id: "u-1",
    workosUserId: "workos-1",
    email: "user@example.com",
    firstName: null,
    lastName: null,
    userType: "organization",
    centralServicesRole: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}

class FakeUserRepo implements UserRepository {
  private byWorkos = new Map<string, User>();
  upserts: Array<
    SyncUserInput & { userType: UserType; centralServicesRole: CentralServicesRole | null }
  > = [];

  async findById() {
    return null;
  }
  async findByWorkosUserId(workosUserId: string) {
    return this.byWorkos.get(workosUserId) ?? null;
  }
  async upsertFromWorkos(input: Parameters<UserRepository["upsertFromWorkos"]>[0]) {
    this.upserts.push(input);
    const existing = this.byWorkos.get(input.workosUserId);
    const user: User = existing
      ? makeUser({
          ...existing,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
        })
      : makeUser({
          workosUserId: input.workosUserId,
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          userType: input.userType,
          centralServicesRole: input.centralServicesRole,
        });
    this.byWorkos.set(input.workosUserId, user);
    return user;
  }
  seedExisting(user: User) {
    this.byWorkos.set(user.workosUserId, user);
  }
}

class FakeCsDomains implements CentralServicesDomainsRepository {
  private domains = new Set<string>();
  async isCentralServicesDomain(domain: string) {
    return this.domains.has(domain.toLowerCase());
  }
  async list() {
    return [];
  }
  async insert() {}
  async delete() {}
  register(domain: string) {
    this.domains.add(domain.toLowerCase());
  }
}

describe("UserService.syncFromWorkos classification", () => {
  const originalEnv = process.env.GLOBAL_ADMIN_EMAIL;
  beforeEach(() => {
    process.env.GLOBAL_ADMIN_EMAIL = undefined;
  });
  afterEach(() => {
    if (originalEnv === undefined) process.env.GLOBAL_ADMIN_EMAIL = undefined;
    else process.env.GLOBAL_ADMIN_EMAIL = originalEnv;
  });

  it("classifies a brand new user as 'organization' by default", async () => {
    const repo = new FakeUserRepo();
    const cs = new FakeCsDomains();
    const service = new UserService(repo, cs);
    await service.syncFromWorkos({
      workosUserId: "w-1",
      email: "alice@somewhere.com",
      firstName: "Alice",
      lastName: null,
    });
    expect(repo.upserts[0]?.userType).toBe("organization");
    expect(repo.upserts[0]?.centralServicesRole).toBeNull();
  });

  it("classifies as 'central_services' admin when email matches GLOBAL_ADMIN_EMAIL", async () => {
    process.env.GLOBAL_ADMIN_EMAIL = "boss@bgreen.io";
    const repo = new FakeUserRepo();
    const cs = new FakeCsDomains();
    const service = new UserService(repo, cs);
    await service.syncFromWorkos({
      workosUserId: "w-1",
      email: "Boss@bgreen.io",
      firstName: null,
      lastName: null,
    });
    expect(repo.upserts[0]?.userType).toBe("central_services");
    expect(repo.upserts[0]?.centralServicesRole).toBe("admin");
  });

  it("classifies via CS domain table when email-domain matches", async () => {
    const repo = new FakeUserRepo();
    const cs = new FakeCsDomains();
    cs.register("nomad.consulting");
    const service = new UserService(repo, cs);
    await service.syncFromWorkos({
      workosUserId: "w-1",
      email: "consultant@nomad.consulting",
      firstName: null,
      lastName: null,
    });
    expect(repo.upserts[0]?.userType).toBe("central_services");
    expect(repo.upserts[0]?.centralServicesRole).toBe("maintainer");
  });

  it("preserves immutability — never overwrites userType on re-sync", async () => {
    const repo = new FakeUserRepo();
    const cs = new FakeCsDomains();
    cs.register("nomad.consulting");
    // Pre-existing org user, even with CS-matching email.
    repo.seedExisting(
      makeUser({
        workosUserId: "w-1",
        email: "consultant@nomad.consulting",
        userType: "organization",
        centralServicesRole: null,
      }),
    );
    const service = new UserService(repo, cs);
    await service.syncFromWorkos({
      workosUserId: "w-1",
      email: "consultant@nomad.consulting",
      firstName: "Updated",
      lastName: null,
    });
    expect(repo.upserts[0]?.userType).toBe("organization");
    expect(repo.upserts[0]?.centralServicesRole).toBeNull();
  });

  it("GLOBAL_ADMIN_EMAIL beats CS domain match when both apply", async () => {
    process.env.GLOBAL_ADMIN_EMAIL = "boss@bgreen.io";
    const repo = new FakeUserRepo();
    const cs = new FakeCsDomains();
    cs.register("bgreen.io"); // also a CS domain
    const service = new UserService(repo, cs);
    await service.syncFromWorkos({
      workosUserId: "w-1",
      email: "boss@bgreen.io",
      firstName: null,
      lastName: null,
    });
    expect(repo.upserts[0]?.centralServicesRole).toBe("admin");
  });
});
