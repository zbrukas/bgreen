// One-off seed: mirror every organization_memberships row + every CS
// user in `users` into WorkOS FGA. Safe to re-run; writeWarrant is
// idempotent for identical tuples.
//
// Usage: `pnpm --filter @bgreen/api seed-fga`. Requires:
//   * WORKOS_API_KEY set in the environment.
//   * The FGA project's schema deployed in the WorkOS dashboard
//     (see plans/bgreen/05-workflows-audit-fga.md for the DSL).

import { db, schema } from "@bgreen/db";
import { getFgaClient } from "../src/fga-client.js";

const CS_WORKSPACE_RESOURCE_ID = "00000000-0000-0000-0000-000000000000";

async function main() {
  const fga = getFgaClient();
  let written = 0;
  let failed = 0;

  // 1) Organization memberships → org-scoped warrants.
  const memberships = await db.select().from(schema.organizationMemberships);
  console.log(`Found ${memberships.length} membership rows to mirror into FGA.`);
  for (const m of memberships) {
    try {
      await fga.writeWarrant({
        resource: { resourceType: "organization", resourceId: m.organizationId },
        relation: m.role,
        subject: { resourceType: "user", resourceId: m.userId },
      });
      written++;
    } catch (err) {
      failed++;
      console.warn(
        `  org-membership failed: org=${m.organizationId} user=${m.userId} role=${m.role} — ${(err as Error).message}`,
      );
    }
  }

  // 2) Central-services users → CS workspace warrants.
  const csUsers = await db.select().from(schema.users);
  const csOnly = csUsers.filter(
    (u) => u.userType === "central_services" && u.centralServicesRole !== null,
  );
  console.log(`Found ${csOnly.length} central-services users to mirror into FGA.`);
  for (const u of csOnly) {
    try {
      await fga.writeWarrant({
        resource: {
          resourceType: "central_services_workspace",
          resourceId: CS_WORKSPACE_RESOURCE_ID,
        },
        relation: u.centralServicesRole as string,
        subject: { resourceType: "user", resourceId: u.id },
      });
      written++;
    } catch (err) {
      failed++;
      console.warn(
        `  cs-user failed: user=${u.id} role=${u.centralServicesRole} — ${(err as Error).message}`,
      );
    }
  }

  console.log(`Done. ${written} warrants written, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
