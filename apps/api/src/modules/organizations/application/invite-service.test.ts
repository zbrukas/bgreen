import type { Invite, Organization, OrganizationMembership, User } from "@bgreen/types";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AuditService } from "../../audit/application/audit-service.js";
import type { UserRepository } from "../../identity/application/user-service.js";
import { type InviteRepository, InviteService } from "./invite-service.js";
import type { MembershipRepository, OrganizationRepository } from "./organization-service.js";

const now = "2026-01-01T00:00:00.000Z";
const later = "2026-01-08T00:00:00.000Z";

function makeInvite(overrides: Partial<Invite> = {}): Invite {
  return {
    id: "inv-1",
    organizationId: "org-1",
    invitedEmail: "new.user@example.com",
    role: "org_user_write",
    topicScope: [],
    token: "token-1",
    invitedByUserId: "u-admin",
    status: "pending",
    expiresAt: later,
    createdAt: now,
    acceptedAt: null,
    acceptedByUserId: null,
    ...overrides,
  };
}

function makeOrg(overrides: Partial<Organization> = {}): Organization {
  return {
    id: "org-1",
    workosOrganizationId: null,
    name: "Acme",
    nif: null,
    caeCode: null,
    legalForm: null,
    selfReportedSize: null,
    postalCode: null,
    addressLine: null,
    freguesia: null,
    concelho: null,
    distrito: null,
    logoUrl: null,
    brandPrimaryColor: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: "u-admin",
    workosUserId: "workos-admin",
    email: "admin@example.com",
    firstName: null,
    lastName: null,
    userType: "organization",
    centralServicesRole: null,
    passwordHash: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeMembership(overrides: Partial<OrganizationMembership> = {}): OrganizationMembership {
  return {
    userId: "u-existing",
    organizationId: "org-1",
    role: "org_user_read",
    topicScope: [],
    createdAt: now,
    ...overrides,
  };
}

function setup(seedInvite: Invite | null = makeInvite()) {
  let invite = seedInvite;
  const inserted: Array<Parameters<InviteRepository["insert"]>[0]> = [];
  const invites: InviteRepository = {
    insert: vi.fn(async (input) => {
      inserted.push(input);
      invite = makeInvite({
        organizationId: input.organizationId,
        invitedEmail: input.invitedEmail,
        role: input.role,
        token: input.token,
        invitedByUserId: input.invitedByUserId,
        expiresAt: input.expiresAt.toISOString(),
        topicScope: input.topicScope,
      });
      return invite;
    }),
    findByToken: vi.fn(async (token) => (invite?.token === token ? invite : null)),
    markAccepted: vi.fn(async (input) => {
      invite = makeInvite({
        ...invite,
        status: "accepted",
        acceptedByUserId: input.acceptedByUserId,
        acceptedAt: now,
      });
      return invite;
    }),
  };
  const memberships: MembershipRepository = {
    add: vi.fn(async (input) =>
      makeMembership({
        userId: input.userId,
        organizationId: input.organizationId,
        role: input.role,
        topicScope: input.topicScope ?? [],
      }),
    ),
    update: vi.fn(async () => null),
    listForUser: vi.fn(async () => []),
    listForOrganization: vi.fn(async () => []),
    findByUserAndOrg: vi.fn(async () => null),
  };
  const orgs: OrganizationRepository = {
    create: vi.fn(async () => makeOrg()),
    findById: vi.fn(async (id) => (id === "org-1" ? makeOrg() : null)),
    listForUser: vi.fn(async () => []),
    updateBranding: vi.fn(async () => null),
  };
  const users: UserRepository = {
    findById: vi.fn(async (id) => (id === "u-admin" ? makeUser() : null)),
    findByWorkosUserId: vi.fn(async () => null),
    upsertFromWorkos: vi.fn(async () => makeUser()),
  };
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const service = new InviteService(invites, memberships, orgs, users, audit);
  return { service, invites, memberships, orgs, users, audit, inserted };
}

describe("InviteService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(now));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("normalizes invited email, defaults topic scope, and audits invite creation", async () => {
    const { service, inserted, audit } = setup();

    const invite = await service.create({
      organizationId: "org-1",
      invitedEmail: "  New.User@Example.com  ",
      role: "org_user_write",
      invitedByUserId: "u-admin",
    });

    expect(inserted[0]).toEqual(
      expect.objectContaining({
        invitedEmail: "new.user@example.com",
        role: "org_user_write",
        invitedByUserId: "u-admin",
        topicScope: [],
      }),
    );
    expect(inserted[0]?.expiresAt.toISOString()).toBe(later);
    expect(invite.invitedEmail).toBe("new.user@example.com");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u-admin",
        organizationId: "org-1",
        entityKind: "organization_invite",
        action: "invite.created",
      }),
    );
  });

  it("returns preview data only for the invited email", async () => {
    const { service } = setup();

    await expect(
      service.preview({ token: "token-1", userEmail: "other@example.com" }),
    ).resolves.toEqual({
      error: "email_mismatch",
    });

    await expect(
      service.preview({ token: "token-1", userEmail: "NEW.USER@example.com" }),
    ).resolves.toMatchObject({
      preview: {
        organizationName: "Acme",
        inviterEmail: "admin@example.com",
        invitedEmail: "new.user@example.com",
        role: "org_user_write",
      },
    });
  });

  it("accepts an invite, creates membership with topic scope, closes the invite, and audits", async () => {
    const { service, memberships, invites, audit } = setup(
      makeInvite({ topicScope: ["topic-a", "topic-b"] }),
    );

    const result = await service.accept({
      token: "token-1",
      userId: "u-new",
      userEmail: "new.user@example.com",
    });

    expect(result).toEqual({ organizationId: "org-1" });
    expect(memberships.add).toHaveBeenCalledWith({
      userId: "u-new",
      organizationId: "org-1",
      role: "org_user_write",
      topicScope: ["topic-a", "topic-b"],
    });
    expect(invites.markAccepted).toHaveBeenCalledWith({
      token: "token-1",
      acceptedByUserId: "u-new",
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u-new",
        organizationId: "org-1",
        entityKind: "organization_invite",
        action: "invite.accepted",
      }),
    );
  });

  it("accept is idempotent for existing members but still marks the invite accepted", async () => {
    const { service, memberships, invites } = setup();
    vi.mocked(memberships.listForUser).mockResolvedValueOnce([makeMembership({ userId: "u-new" })]);

    const result = await service.accept({
      token: "token-1",
      userId: "u-new",
      userEmail: "new.user@example.com",
    });

    expect(result).toEqual({ organizationId: "org-1" });
    expect(memberships.add).not.toHaveBeenCalled();
    expect(invites.markAccepted).toHaveBeenCalledWith({
      token: "token-1",
      acceptedByUserId: "u-new",
    });
  });
});
