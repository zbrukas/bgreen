// Direct DB-backed authorization checks. Replaces the FGA layer
// (WorkOS sunset FGA in November 2025); the bGreen permission model is
// flat enough that row lookups against users + organization_memberships
// answer every gate we have today. If permissioning grows beyond what
// rows can express, swap in a service then.

import { db, schema } from "@bgreen/db";
import type { CentralServicesRole, MembershipRole } from "@bgreen/types";
import { and, eq } from "drizzle-orm";

// V5.4: singleton central-services workspace. The well-known zero UUID
// remains useful as a stable id (audit_log scoping, future references).
export const CS_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export class ForbiddenError extends Error {
  constructor(public readonly reason: string) {
    super(`forbidden: ${reason}`);
    this.name = "ForbiddenError";
  }
}

async function fetchMembershipRole(
  userId: string,
  organizationId: string,
): Promise<MembershipRole | null> {
  const rows = await db
    .select({ role: schema.organizationMemberships.role })
    .from(schema.organizationMemberships)
    .where(
      and(
        eq(schema.organizationMemberships.userId, userId),
        eq(schema.organizationMemberships.organizationId, organizationId),
      ),
    )
    .limit(1);
  return rows[0]?.role ?? null;
}

async function fetchCsRole(userId: string): Promise<CentralServicesRole | null> {
  const rows = await db
    .select({ role: schema.users.centralServicesRole, userType: schema.users.userType })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  const row = rows[0];
  if (!row || row.userType !== "central_services") return null;
  return row.role;
}

export async function canOrgRelation(
  userId: string,
  organizationId: string,
  relation: MembershipRole,
): Promise<boolean> {
  return (await fetchMembershipRole(userId, organizationId)) === relation;
}

export async function requireOrgRelation(
  userId: string,
  organizationId: string,
  relation: MembershipRole,
): Promise<void> {
  if (!(await canOrgRelation(userId, organizationId, relation))) {
    throw new ForbiddenError(`requires ${relation} on organization ${organizationId}`);
  }
}

export async function canCsRelation(
  userId: string,
  relation: CentralServicesRole,
): Promise<boolean> {
  return (await fetchCsRole(userId)) === relation;
}

export async function requireCsRelation(
  userId: string,
  relation: CentralServicesRole,
): Promise<void> {
  if (!(await canCsRelation(userId, relation))) {
    throw new ForbiddenError(`requires ${relation} on central services workspace`);
  }
}

// True for admin OR maintainer on the CS workspace. Used by every
// template / topic / review write route.
export async function canCsWrite(userId: string): Promise<boolean> {
  const role = await fetchCsRole(userId);
  return role === "admin" || role === "maintainer";
}
