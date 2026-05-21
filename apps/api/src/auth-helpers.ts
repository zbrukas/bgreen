// Tiny helpers used by route handlers to gate on FGA relations. The
// underlying check() is async — wrapping it here keeps individual
// routes free of FGA-import boilerplate and routes the typed error
// through the fgaMiddleware → 403 path.

import { type CsRelation, type OrgRelation, requireCan } from "@bgreen/auth";
import { fgaClient } from "./services.js";

export async function requireOrgRelation(
  userId: string,
  organizationId: string,
  relation: OrgRelation,
): Promise<void> {
  await requireCan(fgaClient, {
    actor: { kind: "user", id: userId },
    action: relation,
    resource: { kind: "organization", id: organizationId },
  });
}

export async function canOrgRelation(
  userId: string,
  organizationId: string,
  relation: OrgRelation,
): Promise<boolean> {
  try {
    await requireOrgRelation(userId, organizationId, relation);
    return true;
  } catch {
    return false;
  }
}

// V5.4: singleton central-services workspace. The resource id is the
// well-known zero UUID — written once on first global-admin seed and
// re-used as the parent of every CS-side warrant.
export const CS_WORKSPACE_ID = "00000000-0000-0000-0000-000000000000";

export async function requireCsRelation(userId: string, relation: CsRelation): Promise<void> {
  await requireCan(fgaClient, {
    actor: { kind: "user", id: userId },
    action: relation,
    resource: { kind: "central_services_workspace", id: CS_WORKSPACE_ID },
  });
}

export async function canCsRelation(userId: string, relation: CsRelation): Promise<boolean> {
  try {
    await requireCsRelation(userId, relation);
    return true;
  } catch {
    return false;
  }
}

// Composite — true when the user is an admin or a maintainer on the CS
// workspace. Used by template-write routes (create/update/publish).
export async function canCsWrite(userId: string): Promise<boolean> {
  if (await canCsRelation(userId, "admin")) return true;
  return canCsRelation(userId, "maintainer");
}
