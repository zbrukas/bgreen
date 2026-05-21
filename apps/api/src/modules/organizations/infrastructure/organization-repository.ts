import { db, orgScope, schema } from "@bgreen/db";
import { eq } from "drizzle-orm";
import type {
  AddMembershipInput,
  CreateOrganizationInput,
  MembershipRepository,
  OrganizationRepository,
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
}

export class DrizzleMembershipRepository implements MembershipRepository {
  async add(input: AddMembershipInput): Promise<OrganizationMembership> {
    const [row] = await db
      .insert(schema.organizationMemberships)
      .values({
        userId: input.userId,
        organizationId: input.organizationId,
        role: input.role,
      })
      .returning();
    if (!row) {
      throw new Error("add membership: unexpected empty returning() result");
    }
    return rowToMembership(row);
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
