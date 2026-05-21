import { db, schema } from "@bgreen/db";
import type { CentralServicesRole, User, UserType } from "@bgreen/types";
import { eq } from "drizzle-orm";
import type { SyncUserInput, UserRepository } from "../application/user-service.js";

function rowToUser(row: typeof schema.users.$inferSelect): User {
  return {
    id: row.id,
    workosUserId: row.workosUserId,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    userType: row.userType,
    centralServicesRole: row.centralServicesRole,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleUserRepository implements UserRepository {
  async findById(id: string): Promise<User | null> {
    const rows = await db.select().from(schema.users).where(eq(schema.users.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToUser(row) : null;
  }

  async findByWorkosUserId(workosUserId: string): Promise<User | null> {
    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.workosUserId, workosUserId))
      .limit(1);
    const row = rows[0];
    return row ? rowToUser(row) : null;
  }

  // V5.4: classification fields go in on INSERT only. The onConflict
  // path explicitly omits them so re-syncs from WorkOS can never
  // overwrite the population side — that's the immutability invariant.
  async upsertFromWorkos(
    input: SyncUserInput & {
      userType: UserType;
      centralServicesRole: CentralServicesRole | null;
    },
  ): Promise<User> {
    const [row] = await db
      .insert(schema.users)
      .values({
        workosUserId: input.workosUserId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        userType: input.userType,
        centralServicesRole: input.centralServicesRole,
      })
      .onConflictDoUpdate({
        target: schema.users.workosUserId,
        set: {
          email: input.email,
          firstName: input.firstName,
          lastName: input.lastName,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) {
      throw new Error("upsertFromWorkos: unexpected empty returning() result");
    }
    return rowToUser(row);
  }
}
