import type { Organization, OrganizationMembership } from "@bgreen/types";
import { describe, expect, it, vi } from "vitest";
import type { AuditService } from "../../audit/application/audit-service.js";
import {
  type MembershipRepository,
  type OrganizationRepository,
  OrganizationService,
} from "./organization-service.js";

const now = "2026-01-01T00:00:00.000Z";

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

function makeMembership(overrides: Partial<OrganizationMembership> = {}): OrganizationMembership {
  return {
    userId: "u-owner",
    organizationId: "org-1",
    role: "org_admin",
    topicScope: [],
    createdAt: now,
    ...overrides,
  };
}

function setup() {
  let org = makeOrg();
  const orgs: OrganizationRepository = {
    create: vi.fn(async (input) => {
      org = makeOrg({ name: input.name });
      return org;
    }),
    findById: vi.fn(async (id) => (id === org.id ? org : null)),
    listForUser: vi.fn(async () => [org]),
    updateBranding: vi.fn(async (input) => {
      if (input.organizationId !== org.id) return null;
      org = makeOrg({
        ...org,
        logoUrl: input.logoUrl === undefined ? org.logoUrl : input.logoUrl,
        brandPrimaryColor:
          input.brandPrimaryColor === undefined ? org.brandPrimaryColor : input.brandPrimaryColor,
      });
      return org;
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
  const audit = { record: vi.fn(async () => undefined) } as unknown as AuditService;
  const service = new OrganizationService(orgs, memberships, audit);
  return { service, orgs, memberships, audit };
}

describe("OrganizationService", () => {
  it("creates an owner membership and writes an organization-created audit event", async () => {
    const { service, orgs, memberships, audit } = setup();

    const result = await service.createWithOwner({
      ownerUserId: "u-owner",
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
    });

    expect(orgs.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Acme" }));
    expect(memberships.add).toHaveBeenCalledWith({
      userId: "u-owner",
      organizationId: "org-1",
      role: "org_admin",
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "u-owner",
        organizationId: "org-1",
        entityKind: "organization",
        entityId: "org-1",
        action: "organization.created",
      }),
    );
    expect(result.membership.role).toBe("org_admin");
  });

  it("updates only provided branding fields and audits the partial payload", async () => {
    const { service, audit } = setup();

    const updated = await service.updateBranding({
      organizationId: "org-1",
      actorUserId: "u-admin",
      brandPrimaryColor: "#006b4f",
    });

    expect(updated?.brandPrimaryColor).toBe("#006b4f");
    expect(updated?.logoUrl).toBeNull();
    expect(audit.record).toHaveBeenCalledWith({
      actorUserId: "u-admin",
      organizationId: "org-1",
      entityKind: "organization",
      entityId: "org-1",
      action: "organization.branding_updated",
      payload: { logoUrl: undefined, brandPrimaryColor: "#006b4f" },
    });
  });

  it("does not audit branding changes when the organization does not exist", async () => {
    const { service, audit } = setup();

    const result = await service.updateBranding({
      organizationId: "missing",
      actorUserId: "u-admin",
      logoUrl: "https://example.test/logo.png",
    });

    expect(result).toBeNull();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
