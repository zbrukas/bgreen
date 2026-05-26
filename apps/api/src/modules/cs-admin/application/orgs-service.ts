import { db, schema } from "@bgreen/db";
import type {
  CentralServicesRole,
  CsOrgListOptions,
  LegalForm,
  MembershipRole,
  Organization,
  OrganizationSize,
  TopicSlug,
} from "@bgreen/types";
import { type SQL, and, asc, count, desc, eq, ilike, inArray, or } from "drizzle-orm";

const DEFAULT_PAGE_SIZE = 10;
import type { AuditService } from "../../audit/module.js";

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

// Whitelist of fields CS can edit. `id`, `workosOrganizationId`,
// `createdAt`, `updatedAt` are intentionally out — identity and audit
// fields. New editable fields land here as Carbon-form bindings.
export interface UpdateOrgInput {
  name?: string;
  nif?: string | null;
  caeCode?: string | null;
  legalForm?: LegalForm | null;
  selfReportedSize?: OrganizationSize | null;
  postalCode?: string | null;
  addressLine?: string | null;
  freguesia?: string | null;
  concelho?: string | null;
  distrito?: string | null;
  logoUrl?: string | null;
  brandPrimaryColor?: string | null;
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
  constructor(private readonly audit?: AuditService) {}

  // List every organisation in the system with member counts. Paginated
  // since V12.x — at <1k orgs the count query is still cheap, but slicing
  // limits the joined membership round-trip too.
  async list(
    options: CsOrgListOptions = {},
  ): Promise<{ items: OrgListEntry[]; total: number }> {
    const conditions: SQL[] = [];
    if (options.q) {
      const like = `%${options.q}%`;
      const search = or(
        ilike(schema.organizations.name, like),
        ilike(schema.organizations.nif, like),
        ilike(schema.organizations.distrito, like),
      );
      if (search) conditions.push(search);
    }
    if (options.distrito) {
      conditions.push(eq(schema.organizations.distrito, options.distrito));
    }
    const sortColumn =
      options.sort === "name" ? schema.organizations.name : schema.organizations.createdAt;
    const defaultDir = options.sort === "name" ? "asc" : "desc";
    const dir = options.dir ?? defaultDir;
    const order = dir === "asc" ? asc(sortColumn) : desc(sortColumn);
    const where = conditions.length === 0 ? undefined : and(...conditions);

    const paginate = options.page !== undefined || options.pageSize !== undefined;
    const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
    const page = options.page ?? 1;
    const offset = (page - 1) * pageSize;

    const dataQuery = db
      .select()
      .from(schema.organizations)
      .where(where)
      .orderBy(order);
    const [orgs, totalRow] = await Promise.all([
      paginate ? dataQuery.limit(pageSize).offset(offset) : dataQuery,
      db.select({ value: count() }).from(schema.organizations).where(where),
    ]);
    const total = totalRow[0]?.value ?? 0;

    if (orgs.length === 0) return { items: [], total };

    // Membership counts: scoped to the paginated org ids so we don't
    // pull the whole memberships table on a sliced page.
    const orgIds = orgs.map((o) => o.id);
    const counts = await db
      .select({
        organizationId: schema.organizationMemberships.organizationId,
        role: schema.organizationMemberships.role,
      })
      .from(schema.organizationMemberships)
      .where(inArray(schema.organizationMemberships.organizationId, orgIds));

    const byOrg = new Map<string, { total: number; admin: number }>();
    for (const c of counts) {
      const acc = byOrg.get(c.organizationId) ?? { total: 0, admin: 0 };
      acc.total += 1;
      if (c.role === "org_admin") acc.admin += 1;
      byOrg.set(c.organizationId, acc);
    }

    const items = orgs.map((row) => {
      const organization = rowToOrganization(row);
      const tally = byOrg.get(row.id) ?? { total: 0, admin: 0 };
      return {
        organization,
        memberCount: tally.total,
        adminCount: tally.admin,
      };
    });
    return { items, total };
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

  async update(input: {
    organizationId: string;
    patch: UpdateOrgInput;
    actorUserId: string;
  }): Promise<Organization | null> {
    const changedKeys = Object.keys(input.patch).filter(
      (k) => input.patch[k as keyof UpdateOrgInput] !== undefined,
    );
    if (changedKeys.length === 0) {
      // No-op patch — return current row without writing or auditing.
      const existing = await db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, input.organizationId))
        .limit(1);
      const row = existing[0];
      return row ? rowToOrganization(row) : null;
    }
    const [row] = await db
      .update(schema.organizations)
      .set({
        ...(input.patch.name !== undefined ? { name: input.patch.name } : {}),
        ...(input.patch.nif !== undefined ? { nif: input.patch.nif } : {}),
        ...(input.patch.caeCode !== undefined ? { caeCode: input.patch.caeCode } : {}),
        ...(input.patch.legalForm !== undefined ? { legalForm: input.patch.legalForm } : {}),
        ...(input.patch.selfReportedSize !== undefined
          ? { selfReportedSize: input.patch.selfReportedSize }
          : {}),
        ...(input.patch.postalCode !== undefined ? { postalCode: input.patch.postalCode } : {}),
        ...(input.patch.addressLine !== undefined ? { addressLine: input.patch.addressLine } : {}),
        ...(input.patch.freguesia !== undefined ? { freguesia: input.patch.freguesia } : {}),
        ...(input.patch.concelho !== undefined ? { concelho: input.patch.concelho } : {}),
        ...(input.patch.distrito !== undefined ? { distrito: input.patch.distrito } : {}),
        ...(input.patch.logoUrl !== undefined ? { logoUrl: input.patch.logoUrl } : {}),
        ...(input.patch.brandPrimaryColor !== undefined
          ? { brandPrimaryColor: input.patch.brandPrimaryColor }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.organizations.id, input.organizationId))
      .returning();
    if (!row) return null;
    if (this.audit) {
      await this.audit.record({
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        entityKind: "organization",
        entityId: input.organizationId,
        action: "organization.cs_edit",
        payload: { changedKeys },
      });
    }
    return rowToOrganization(row);
  }

  async delete(input: {
    organizationId: string;
    actorUserId: string;
  }): Promise<{ deleted: boolean }> {
    // Audit row goes in first so we have a record even if the cascade
    // wipes the org and its children. organizationId column survives
    // (audit_log.organization_id has ON DELETE CASCADE — so the audit
    // row will be deleted too). For now the cascade behaviour is the
    // truth; if we ever want immutable delete trails, point the FK to
    // ON DELETE SET NULL and tombstone the org row instead.
    if (this.audit) {
      await this.audit.record({
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        entityKind: "organization",
        entityId: input.organizationId,
        action: "organization.cs_delete",
        payload: {},
      });
    }
    const removed = await db
      .delete(schema.organizations)
      .where(eq(schema.organizations.id, input.organizationId))
      .returning({ id: schema.organizations.id });
    return { deleted: removed.length > 0 };
  }
}
