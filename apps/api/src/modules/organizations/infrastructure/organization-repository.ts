import { db, orgScope, schema } from "@bgreen/db";
import type { MembershipRole } from "@bgreen/types";
import { and, eq } from "drizzle-orm";
import type {
  AddMembershipInput,
  CreateOrganizationInput,
  MembershipRepository,
  OrganizationRepository,
  UpdateMembershipInput,
} from "../application/organization-service.js";
import type { OrganizationMembership } from "../domain/organization-membership.js";
import type { Organization } from "../domain/organization.js";

function rowToOrganization(row: typeof schema.organizations.$inferSelect): Organization {
  return {
    id: row.id,
    workosOrganizationId: row.workosOrganizationId,
    name: row.name,
    nif: row.nif,
    caeCode: row.caeCode,
    legalForm: row.legalForm,
    selfReportedSize: row.selfReportedSize,
    postalCode: row.postalCode,
    addressLine: row.addressLine,
    freguesia: row.freguesia,
    concelho: row.concelho,
    distrito: row.distrito,
    logoUrl: row.logoUrl,
    brandPrimaryColor: row.brandPrimaryColor,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function rowToMembership(
  row: typeof schema.organizationMemberships.$inferSelect,
): OrganizationMembership {
  return {
    userId: row.userId,
    organizationId: row.organizationId,
    role: row.role,
    topicScope: row.topicScope ?? [],
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleOrganizationRepository implements OrganizationRepository {
  async create(input: CreateOrganizationInput): Promise<Organization> {
    const [row] = await db
      .insert(schema.organizations)
      .values({
        name: input.name,
        nif: input.nif,
        caeCode: input.caeCode,
        legalForm: input.legalForm,
        selfReportedSize: input.selfReportedSize,
        postalCode: input.postalCode,
        addressLine: input.addressLine,
        freguesia: input.freguesia,
        concelho: input.concelho,
        distrito: input.distrito,
        workosOrganizationId: input.workosOrganizationId ?? null,
      })
      .returning();
    if (!row) {
      throw new Error("create organization: unexpected empty returning() result");
    }
    return rowToOrganization(row);
  }

  async findById(organizationId: string): Promise<Organization | null> {
    const rows = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1);
    const row = rows[0];
    return row ? rowToOrganization(row) : null;
  }

  async listForUser(userId: string): Promise<Organization[]> {
    const rows = await db
      .select({ organization: schema.organizations })
      .from(schema.organizationMemberships)
      .innerJoin(
        schema.organizations,
        eq(schema.organizationMemberships.organizationId, schema.organizations.id),
      )
      .where(eq(schema.organizationMemberships.userId, userId));
    return rows.map((r) => rowToOrganization(r.organization));
  }

  async updateBranding(input: {
    organizationId: string;
    logoUrl?: string | null;
    brandPrimaryColor?: string | null;
  }): Promise<Organization | null> {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.logoUrl !== undefined) set.logoUrl = input.logoUrl;
    if (input.brandPrimaryColor !== undefined) {
      set.brandPrimaryColor = input.brandPrimaryColor;
    }
    // Empty patch → no-op write; just fetch + return.
    if (Object.keys(set).length === 1) {
      return this.findById(input.organizationId);
    }
    const [row] = await db
      .update(schema.organizations)
      .set(set)
      .where(eq(schema.organizations.id, input.organizationId))
      .returning();
    return row ? rowToOrganization(row) : null;
  }
}

export class DrizzleMembershipRepository implements MembershipRepository {
  async add(input: AddMembershipInput): Promise<OrganizationMembership> {
    const [row] = await db
      .insert(schema.organizationMemberships)
      .values({
        userId: input.userId,
        organizationId: input.organizationId,
        role: input.role,
        topicScope: input.topicScope ?? [],
      })
      .returning();
    if (!row) {
      throw new Error("add membership: unexpected empty returning() result");
    }
    return rowToMembership(row);
  }

  async update(input: UpdateMembershipInput): Promise<OrganizationMembership | null> {
    const set: { role?: MembershipRole; topicScope?: string[] } = {};
    if (input.role !== undefined) set.role = input.role;
    if (input.topicScope !== undefined) set.topicScope = input.topicScope;
    if (Object.keys(set).length === 0) {
      return this.findByUserAndOrg(input.userId, input.organizationId);
    }
    const [row] = await db
      .update(schema.organizationMemberships)
      .set(set)
      .where(
        and(
          eq(schema.organizationMemberships.userId, input.userId),
          eq(schema.organizationMemberships.organizationId, input.organizationId),
        ),
      )
      .returning();
    return row ? rowToMembership(row) : null;
  }

  async findByUserAndOrg(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationMembership | null> {
    const rows = await db
      .select()
      .from(schema.organizationMemberships)
      .where(
        and(
          eq(schema.organizationMemberships.userId, userId),
          eq(schema.organizationMemberships.organizationId, organizationId),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToMembership(row) : null;
  }

  async listForUser(userId: string): Promise<OrganizationMembership[]> {
    const rows = await db
      .select()
      .from(schema.organizationMemberships)
      .where(eq(schema.organizationMemberships.userId, userId));
    return rows.map(rowToMembership);
  }

  async listForOrganization(organizationId: string): Promise<OrganizationMembership[]> {
    const rows = await db
      .select()
      .from(schema.organizationMemberships)
      .where(orgScope(schema.organizationMemberships, organizationId));
    return rows.map(rowToMembership);
  }
}
