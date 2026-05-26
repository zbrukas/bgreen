import { db, schema } from "@bgreen/db";
import type {
  CentralServicesRole,
  MembershipRole,
  Organization,
  TopicSlug,
} from "@bgreen/types";
import { desc, eq } from "drizzle-orm";

// V12.3 follow-up — read-only CS surface listing every organisation
// and per-org members. CS-admin gated; cross-tenant by design. Drilling
// into an org lets CS staff inspect membership without impersonating.

export interface OrgListEntry {
  organization: Organization;
  memberCount: number;
  adminCount: number;
}

export interface OrgMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: MembershipRole;
  topicScope: TopicSlug[];
  centralServicesRole: CentralServicesRole | null;
  createdAt: string;
}

export interface OrgDetail {
  organization: Organization;
  members: OrgMember[];
}

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

export class CsOrgsService {
  // List every organisation in the system with member counts. No
  // pagination — at <1k orgs this is a single round-trip and reads
  // cleanly. Convert to keyset pagination if growth makes it noisy.
  async list(): Promise<OrgListEntry[]> {
    const orgs = await db
      .select()
      .from(schema.organizations)
      .orderBy(desc(schema.organizations.createdAt));

    if (orgs.length === 0) return [];

    // Single round-trip for membership counts: aggregate per org_id +
    // count admins separately. Indexed via org_memb_org_idx (V12 H4).
    const counts = await db
      .select({
        organizationId: schema.organizationMemberships.organizationId,
        role: schema.organizationMemberships.role,
      })
      .from(schema.organizationMemberships);

    const byOrg = new Map<string, { total: number; admin: number }>();
    for (const c of counts) {
      const acc = byOrg.get(c.organizationId) ?? { total: 0, admin: 0 };
      acc.total += 1;
      if (c.role === "org_admin") acc.admin += 1;
      byOrg.set(c.organizationId, acc);
    }

    return orgs.map((row) => {
      const organization = rowToOrganization(row);
      const tally = byOrg.get(row.id) ?? { total: 0, admin: 0 };
      return {
        organization,
        memberCount: tally.total,
        adminCount: tally.admin,
      };
    });
  }

  async get(organizationId: string): Promise<OrgDetail | null> {
    const orgRows = await db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1);
    const orgRow = orgRows[0];
    if (!orgRow) return null;

    const memberRows = await db
      .select({
        userId: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        centralServicesRole: schema.users.centralServicesRole,
        role: schema.organizationMemberships.role,
        topicScope: schema.organizationMemberships.topicScope,
        createdAt: schema.organizationMemberships.createdAt,
      })
      .from(schema.organizationMemberships)
      .innerJoin(
        schema.users,
        eq(schema.organizationMemberships.userId, schema.users.id),
      )
      .where(eq(schema.organizationMemberships.organizationId, organizationId))
      .orderBy(schema.organizationMemberships.createdAt);

    const members: OrgMember[] = memberRows.map((m) => ({
      userId: m.userId,
      email: m.email,
      firstName: m.firstName,
      lastName: m.lastName,
      role: m.role,
      topicScope: (m.topicScope ?? []) as TopicSlug[],
      centralServicesRole: m.centralServicesRole,
      createdAt: m.createdAt.toISOString(),
    }));

    return { organization: rowToOrganization(orgRow), members };
  }
}
