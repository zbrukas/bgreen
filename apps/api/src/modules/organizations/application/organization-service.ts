import type { OrganizationSize } from "@bgreen/types";
import type { AuditService } from "../../audit/module.js";
import { buildEntityDiff } from "../../audit/module.js";
import type { LegalForm } from "../domain/legal-form.js";
import type { MembershipRole, OrganizationMembership } from "../domain/organization-membership.js";
import type { Organization } from "../domain/organization.js";

export interface CreateOrganizationInput {
  name: string;
  nif: string | null;
  caeCode: string | null;
  legalForm: LegalForm | null;
  selfReportedSize: OrganizationSize | null;
  postalCode: string | null;
  addressLine: string | null;
  freguesia: string | null;
  concelho: string | null;
  distrito: string | null;
  workosOrganizationId?: string | null;
}

export interface AddMembershipInput {
  userId: string;
  organizationId: string;
  role: MembershipRole;
}

export interface OrganizationRepository {
  create(input: CreateOrganizationInput): Promise<Organization>;
  findById(organizationId: string): Promise<Organization | null>;
  listForUser(userId: string): Promise<Organization[]>;
}

export interface MembershipRepository {
  add(input: AddMembershipInput): Promise<OrganizationMembership>;
  listForUser(userId: string): Promise<OrganizationMembership[]>;
  listForOrganization(organizationId: string): Promise<OrganizationMembership[]>;
}

export class OrganizationService {
  constructor(
    private readonly orgs: OrganizationRepository,
    private readonly memberships: MembershipRepository,
    private readonly audit: AuditService,
  ) {}

  async createWithOwner(
    input: CreateOrganizationInput & { ownerUserId: string },
  ): Promise<{ organization: Organization; membership: OrganizationMembership }> {
    const organization = await this.orgs.create(input);
    const membership = await this.memberships.add({
      userId: input.ownerUserId,
      organizationId: organization.id,
      role: "org_admin",
    });
    await this.audit.record({
      actorUserId: input.ownerUserId,
      organizationId: organization.id,
      entityKind: "organization",
      entityId: organization.id,
      action: "organization.created",
      payload: buildEntityDiff(null, organization as unknown as Record<string, unknown>),
    });
    return { organization, membership };
  }

  async listOrganizationsForUser(userId: string): Promise<Organization[]> {
    return this.orgs.listForUser(userId);
  }
}
