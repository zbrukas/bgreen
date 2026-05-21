// Boot-time seed: if GLOBAL_ADMIN_EMAIL is set and a user with that
// email already exists, ensure they're marked as a central-services
// admin. The email-domain classification path handles fresh sign-ups,
// but this script lets an existing org user (e.g., from before V5.4)
// be promoted by setting an env var + restarting.

import { db, schema } from "@bgreen/db";
import { eq } from "drizzle-orm";
import { fgaClient } from "./services.js";

const CS_WORKSPACE_RESOURCE_ID = "00000000-0000-0000-0000-000000000000";

export async function ensureGlobalAdmin(): Promise<void> {
  const raw = process.env.GLOBAL_ADMIN_EMAIL;
  if (!raw) return;
  const email = raw.trim().toLowerCase();
  if (email === "") return;

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  if (!user) {
    // Hasn't signed in yet — the syncFromWorkos classifier will pick
    // them up on first sign-in. Nothing to do.
    return;
  }

  const alreadyPromoted =
    user.userType === "central_services" && user.centralServicesRole === "admin";
  if (!alreadyPromoted) {
    await db
      .update(schema.users)
      .set({
        userType: "central_services",
        centralServicesRole: "admin",
        updatedAt: new Date(),
      })
      .where(eq(schema.users.id, user.id));
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
      subject: { resourceType: "user", resourceId: user.id },
    });
  } catch (err) {
    // Don't crash the boot if FGA seeding fails — log and let the API
    // come up; the real CS check still works against user_type until
    // V5.4d wires FGA into the route gate.
    console.warn(
      `seed-global-admin: failed to write FGA warrant for ${email} — ${(err as Error).message}`,
    );
  }
}
