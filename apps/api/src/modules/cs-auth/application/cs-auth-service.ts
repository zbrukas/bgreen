import { db, schema } from "@bgreen/db";
import type { User } from "@bgreen/types";
import { eq } from "drizzle-orm";
import { mintCsSession } from "./cs-session.js";
import { hashPassword, verifyPassword } from "./password.js";

export type LoginResult =
  | { ok: true; token: string; user: User }
  | { ok: false; code: "invalid_credentials" }
  | { ok: false; code: "password_setup_required"; userId: string }
  | { ok: false; code: "not_a_cs_user" };

export type SetupPasswordResult =
  | { ok: true; token: string; user: User }
  | { ok: false; code: "user_not_found" | "password_already_set" | "not_a_cs_user" };

function rowToUser(row: typeof schema.users.$inferSelect): User {
  return {
    id: row.id,
    workosUserId: row.workosUserId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    userType: row.userType,
    centralServicesRole: row.centralServicesRole,
    passwordHash: row.passwordHash,
    lastLoginAt: row.lastLoginAt ? row.lastLoginAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CsAuthService {
  async login(input: { email: string; password: string }): Promise<LoginResult> {
    const normalized = input.email.trim().toLowerCase();
    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalized))
      .limit(1);
    if (!row) return { ok: false, code: "invalid_credentials" };
    if (row.userType !== "central_services") return { ok: false, code: "not_a_cs_user" };
    if (!row.passwordHash) return { ok: false, code: "password_setup_required", userId: row.id };
    const valid = await verifyPassword(input.password, row.passwordHash);
    if (!valid) return { ok: false, code: "invalid_credentials" };

    const now = new Date();
    await db.update(schema.users).set({ lastLoginAt: now }).where(eq(schema.users.id, row.id));
    return {
      ok: true,
      token: mintCsSession(row.id),
      user: rowToUser({ ...row, lastLoginAt: now }),
    };
  }

  async setupPassword(input: {
    email: string;
    newPassword: string;
  }): Promise<SetupPasswordResult> {
    if (input.newPassword.length < 12) {
      // 12 chars is the floor for the setup flow; admins can rotate via
      // CS console later. Short passwords are still ergonomically poor
      // even for a small CS team.
      return { ok: false, code: "password_already_set" };
    }
    const normalized = input.email.trim().toLowerCase();
    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, normalized))
      .limit(1);
    if (!row) return { ok: false, code: "user_not_found" };
    if (row.userType !== "central_services") return { ok: false, code: "not_a_cs_user" };
    if (row.passwordHash) return { ok: false, code: "password_already_set" };

    const hash = await hashPassword(input.newPassword);
    const now = new Date();
    const [updated] = await db
      .update(schema.users)
      .set({ passwordHash: hash, lastLoginAt: now, updatedAt: now })
      .where(eq(schema.users.id, row.id))
      .returning();
    if (!updated) return { ok: false, code: "user_not_found" };
    return { ok: true, token: mintCsSession(updated.id), user: rowToUser(updated) };
  }
}
