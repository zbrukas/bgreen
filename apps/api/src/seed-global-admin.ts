// Boot-time seed: ensures the user identified by GLOBAL_ADMIN_EMAIL
// exists as a central-services admin. V5.7 widens this from "promote
// existing user" to "create the row if missing" — the new local-auth
// path lets a CS admin set their own password from the CS console at
// first sign-in, with no WorkOS round-trip required.

import { db, schema } from "@bgreen/db";
import { eq } from "drizzle-orm";
import { fgaClient } from "./services.js";

const CS_WORKSPACE_RESOURCE_ID = "00000000-0000-0000-0000-000000000000";

export async function ensureGlobalAdmin(): Promise<void> {
  const raw = process.env.GLOBAL_ADMIN_EMAIL;
  if (!raw) return;
  const email = raw.trim().toLowerCase();
  if (email === "") return;

  const [existing] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email))
    .limit(1);

  let userId: string;
  if (!existing) {
    // No row at all — create one. workos_user_id stays NULL; the admin
    // will set a password via the CS console's first-sign-in flow.
    const [created] = await db
      .insert(schema.users)
      .values({
        email,
        firstName: null,
        lastName: null,
        userType: "central_services",
        centralServicesRole: "admin",
      })
      .returning({ id: schema.users.id });
    if (!created) {
      console.warn(`seed-global-admin: insert returned no row for ${email}`);
      return;
    }
    userId = created.id;
  } else {
    userId = existing.id;
    const alreadyPromoted =
      existing.userType === "central_services" && existing.centralServicesRole === "admin";
    if (!alreadyPromoted) {
      await db
        .update(schema.users)
        .set({
          userType: "central_services",
          centralServicesRole: "admin",
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, existing.id));
    }
  }

  // Mirror as an FGA warrant. The CS workspace is a fixed singleton.
  // writeWarrant is idempotent for identical tuples.
  try {
    await fgaClient.writeWarrant({
      resource: {
        resourceType: "central_services_workspace",
        resourceId: CS_WORKSPACE_RESOURCE_ID,
      },
      relation: "admin",
      subject: { resourceType: "user", resourceId: userId },
    });
  } catch (err) {
    console.warn(
      `seed-global-admin: failed to write FGA warrant for ${email} — ${(err as Error).message}`,
    );
  }
}
