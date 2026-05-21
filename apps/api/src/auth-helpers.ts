// Tiny helpers used by route handlers to gate on FGA relations. The
// underlying check() is async — wrapping it here keeps individual
// routes free of FGA-import boilerplate and routes the typed error
// through the fgaMiddleware → 403 path.

import { type OrgRelation, requireCan } from "@bgreen/auth";
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
