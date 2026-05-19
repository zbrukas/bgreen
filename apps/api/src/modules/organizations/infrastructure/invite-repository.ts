import { db, schema } from "@bgreen/db";
import type { Invite } from "@bgreen/types";
import { eq } from "drizzle-orm";
import type { InviteRepository } from "../application/invite-service.js";

function rowToInvite(row: typeof schema.organizationInvites.$inferSelect): Invite {
  return {
    id: row.id,
    organizationId: row.organizationId,
    invitedEmail: row.invitedEmail,
    role: row.role,
    token: row.token,
    invitedByUserId: row.invitedByUserId,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    acceptedAt: row.acceptedAt ? row.acceptedAt.toISOString() : null,
    acceptedByUserId: row.acceptedByUserId ?? null,
  };
}

export class DrizzleInviteRepository implements InviteRepository {
  async insert(input: {
    organizationId: string;
    invitedEmail: string;
    role: Invite["role"];
    token: string;
    invitedByUserId: string;
    expiresAt: Date;
  }): Promise<Invite> {
    const [row] = await db
      .insert(schema.organizationInvites)
      .values({
        organizationId: input.organizationId,
        invitedEmail: input.invitedEmail,
        role: input.role,
        token: input.token,
        invitedByUserId: input.invitedByUserId,
        expiresAt: input.expiresAt,
      })
      .returning();
    if (!row) {
      throw new Error("insert invite: unexpected empty returning() result");
    }
    return rowToInvite(row);
  }

  async findByToken(token: string): Promise<Invite | null> {
    const rows = await db
      .select()
      .from(schema.organizationInvites)
      .where(eq(schema.organizationInvites.token, token))
      .limit(1);
    const row = rows[0];
    return row ? rowToInvite(row) : null;
  }

  async markAccepted(input: { token: string; acceptedByUserId: string }): Promise<Invite> {
    const [row] = await db
      .update(schema.organizationInvites)
      .set({
        status: "accepted",
        acceptedAt: new Date(),
        acceptedByUserId: input.acceptedByUserId,
      })
      .where(eq(schema.organizationInvites.token, input.token))
      .returning();
    if (!row) {
      throw new Error("markAccepted: invite not found for token");
    }
    return rowToInvite(row);
  }
}
