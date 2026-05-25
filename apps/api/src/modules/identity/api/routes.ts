import { db, schema } from "@bgreen/db";
import { zValidator } from "@hono/zod-validator";
import { and, desc, eq, gt } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../../context.js";
import { auditService, repositories } from "../../../services.js";

const loginEventInput = z.object({
  organizationId: z.string().uuid(),
});

// V12.1 — dedup window for login events. Cookie refresh, server-component
// rerender, and quick navigation all call setActiveOrgId() in apps/web;
// without dedup we'd emit a `user.login` audit row per navigation. 60s
// is generous — real "login" events are minutes apart at minimum.
const LOGIN_DEDUP_WINDOW_MS = 60_000;

export const identityRoutes = new Hono<AppEnv>()
  .get("/me", (c) => {
    return c.json({
      ...c.var.user,
      activeOrganizationId: c.var.organizationId ?? null,
      activeOrganizationRole: c.var.membershipRole ?? null,
      activeTopicScope: c.var.topicScope ?? [],
    });
  })
  // V12.1 — login audit. Called by apps/web setActiveOrgId() on org pick
  // or org switch. CS users are excluded (their lastLoginAt already tracks
  // sign-ins; folding CS staff into customer engagement metrics would
  // contaminate WAU/MAU). Idempotent — repeated calls within 60s collapse.
  .post("/login-event", zValidator("json", loginEventInput), async (c) => {
    const userId = c.var.user.id;
    const user = await repositories.users.findById(userId);
    if (!user) return c.json({ ok: false, error: "user_not_found" }, 404);
    if (user.userType === "central_services") {
      return c.json({ ok: true, skipped: "cs_user" as const });
    }
    const { organizationId } = c.req.valid("json");
    const cutoff = new Date(Date.now() - LOGIN_DEDUP_WINDOW_MS);
    const recent = await db
      .select({ id: schema.auditLog.id })
      .from(schema.auditLog)
      .where(
        and(
          eq(schema.auditLog.actorUserId, userId),
          eq(schema.auditLog.organizationId, organizationId),
          eq(schema.auditLog.action, "user.login"),
          gt(schema.auditLog.occurredAt, cutoff),
        ),
      )
      .orderBy(desc(schema.auditLog.occurredAt))
      .limit(1);
    if (recent.length > 0) {
      return c.json({ ok: true, skipped: "deduped" as const });
    }
    await auditService.record({
      actorUserId: userId,
      organizationId,
      entityKind: "user",
      entityId: userId,
      action: "user.login",
      payload: {},
    });
    return c.json({ ok: true });
  });
