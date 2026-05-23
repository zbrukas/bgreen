// Boot-time seed: ensures the user identified by GLOBAL_ADMIN_EMAIL
// exists as a central-services admin. V5.7 added the local-auth flow
// so a missing row is created here; V5.8 dropped the FGA warrant write
// (DB row is now the only source of truth for authorization).

import { db, schema } from "@bgreen/db";
import { eq } from "drizzle-orm";

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

  if (!existing) {
    // No row at all — create one. workos_user_id stays NULL; the admin
    // will set a password via the CS console's first-sign-in flow.
    await db.insert(schema.users).values({
      email,
      firstName: null,
      lastName: null,
      userType: "central_services",
      centralServicesRole: "admin",
    });
    return;
  }

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
