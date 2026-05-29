import type { OrganizationSize } from "@bgreen/types";
import type { AuditService } from "../../audit/application/audit-service.js";
import { buildEntityDiff } from "../../audit/domain/audit-writer.js";
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
  // V5.6c: optional at the API boundary; empty array means no restriction.
  topicScope?: string[];
}

export interface UpdateMembershipInput {
  userId: string;
  organizationId: string;
  role?: MembershipRole;
  topicScope?: string[];
}

// V11.4 — branding update. Both fields are optional; absent fields
// are left untouched so the UI can update color without resetting
// the logo + vice versa. Pass `null` explicitly to clear a field.
export interface UpdateBrandingInput {
  organizationId: string;
  logoUrl?: string | null;
  brandPrimaryColor?: string | null;
}

export interface OrganizationRepository {
  create(input: CreateOrganizationInput): Promise<Organization>;
  findById(organizationId: string): Promise<Organization | null>;
  listForUser(userId: string): Promise<Organization[]>;
  updateBranding(input: UpdateBrandingInput): Promise<Organization | null>;
}

export interface MembershipRepository {
  add(input: AddMembershipInput): Promise<OrganizationMembership>;
  update(input: UpdateMembershipInput): Promise<OrganizationMembership | null>;
  listForUser(userId: string): Promise<OrganizationMembership[]>;
  listForOrganization(organizationId: string): Promise<OrganizationMembership[]>;
  findByUserAndOrg(userId: string, organizationId: string): Promise<OrganizationMembership | null>;
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

  // V11.4 — branding update. Validates the row exists, writes the
  // partial update, emits an audit row carrying the new values. The
  // audit payload omits the previous values for simplicity — the
  // audit-log itself is the history, and `buildEntityDiff` is a heavier
  // tool than the two-column update warrants.
  async updateBranding(input: {
    organizationId: string;
    actorUserId: string;
    logoUrl?: string | null;
    brandPrimaryColor?: string | null;
  }): Promise<Organization | null> {
    const updated = await this.orgs.updateBranding({
      organizationId: input.organizationId,
      logoUrl: input.logoUrl,
      brandPrimaryColor: input.brandPrimaryColor,
    });
    if (!updated) return null;
    await this.audit.record({
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      entityKind: "organization",
      entityId: input.organizationId,
      action: "organization.branding_updated",
      payload: {
        logoUrl: input.logoUrl ?? undefined,
        brandPrimaryColor: input.brandPrimaryColor ?? undefined,
      },
    });
    return updated;
  }
}
