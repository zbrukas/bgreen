import { db, schema } from "@bgreen/db";
import { CentralServicesRoleSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { and, eq, isNotNull } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { canCsRelation, canCsWrite } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { recordService, repositories, workflowService } from "../../../services.js";

const reviewInput = z.object({
  decision: z.enum(["approve", "request_changes", "reject"]),
  comment: z.string().max(2000).nullable().optional(),
});

const domainInput = z.object({
  domain: z.string().min(1).max(253),
  note: z.string().max(500).nullable().optional(),
});

const createCsUserInput = z.object({
  email: z.string().email().max(320),
  role: CentralServicesRoleSchema,
});

const updateCsUserInput = z.object({
  role: CentralServicesRoleSchema,
});

// Every /cs/* route requires a central-services user. The check sits in
// every handler since some pages allow any CS role (read) while others
// require admin/maintainer (write).
async function gateCsRead(userId: string): Promise<Response | null> {
  if (await canCsWrite(userId)) return null;
  if (await canCsRelation(userId, "promoter")) return null;
  return Response.json({ error: "central_services_required" }, { status: 403 });
}

async function gateCsAdmin(userId: string): Promise<Response | null> {
  return (await canCsRelation(userId, "admin"))
    ? null
    : Response.json({ error: "central_services_admin_required" }, { status: 403 });
}

export const csRoutes = new Hono<AppEnv>()
  .get("/inbox", async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const instances = await workflowService.listAllSubmitted();
    return c.json(instances);
  })
  .get("/records/:id", async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const record = await repositories.records.findAnyById(c.req.param("id"));
    if (!record) return c.json({ error: "not_found" }, 404);
    return c.json(record);
  })
  .post("/records/:id/review", zValidator("json", reviewInput), async (c) => {
    if (!(await canCsWrite(c.var.user.id))) {
      return c.json({ error: "central_services_required" }, 403);
    }
    const record = await repositories.records.findAnyById(c.req.param("id"));
    if (!record) return c.json({ error: "not_found" }, 404);
    const input = c.req.valid("json");
    const result = await recordService.review({
      organizationId: record.organizationId,
      recordId: record.id,
      reviewerUserId: c.var.user.id,
      decision: input.decision,
      comment: input.comment ?? null,
    });
    if (!result.ok) {
      if (result.code === "record_not_found") return c.json({ error: result.code }, 404);
      return c.json({ error: result.code }, 400);
    }
    return c.json(result.record);
  })
  .get("/domains", async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const list = await repositories.centralServicesDomains.list();
    return c.json(list);
  })
  .post("/domains", zValidator("json", domainInput), async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    const input = c.req.valid("json");
    const normalized = input.domain.trim().toLowerCase().replace(/^@/, "");
    await repositories.centralServicesDomains.insert({
      domain: normalized,
      note: input.note ?? null,
      createdByUserId: c.var.user.id,
    });
    return c.json({ ok: true });
  })
  .delete("/domains/:id", async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    await repositories.centralServicesDomains.delete(c.req.param("id"));
    return c.json({ ok: true });
  })
  // ---- CS user admin (V5.7c) -------------------------------------
  // Admin-only roster management. Listing exposes only fields the
  // console renders; password_hash is intentionally never returned.
  .get("/users", async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    const rows = await db
      .select({
        id: schema.users.id,
        email: schema.users.email,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        centralServicesRole: schema.users.centralServicesRole,
        passwordSet: isNotNull(schema.users.passwordHash),
        lastLoginAt: schema.users.lastLoginAt,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.userType, "central_services"))
      .orderBy(schema.users.email);
    return c.json(
      rows.map((r) => ({
        id: r.id,
        email: r.email,
        firstName: r.firstName,
        lastName: r.lastName,
        centralServicesRole: r.centralServicesRole,
        passwordSet: r.passwordSet,
        lastLoginAt: r.lastLoginAt ? r.lastLoginAt.toISOString() : null,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  })
  .post("/users", zValidator("json", createCsUserInput), async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    const input = c.req.valid("json");
    const email = input.email.trim().toLowerCase();
    // Email is unique at the DB level; surface a clean 409 instead of
    // letting the constraint violation bubble up.
    const [existing] = await db
      .select({ id: schema.users.id, userType: schema.users.userType })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);
    if (existing) {
      if (existing.userType !== "central_services") {
        return c.json({ error: "email_belongs_to_org_user" }, 409);
      }
      return c.json({ error: "email_taken" }, 409);
    }
    const [created] = await db
      .insert(schema.users)
      .values({
        email,
        firstName: null,
        lastName: null,
        userType: "central_services",
        centralServicesRole: input.role,
      })
      .returning({ id: schema.users.id });
    if (!created) return c.json({ error: "insert_failed" }, 500);
    // No password yet; the new user goes through /setup-password on
    // first sign-in (CS app already routes 409 → that page).
    return c.json({ id: created.id, email, role: input.role }, 201);
  })
  .patch("/users/:id", zValidator("json", updateCsUserInput), async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    const targetId = c.req.param("id");
    const input = c.req.valid("json");
    if (c.var.user.id === targetId && input.role !== "admin") {
      return c.json({ error: "cannot_demote_self" }, 400);
    }
    const [updated] = await db
      .update(schema.users)
      .set({ centralServicesRole: input.role, updatedAt: new Date() })
      .where(and(eq(schema.users.id, targetId), eq(schema.users.userType, "central_services")))
      .returning({ id: schema.users.id });
    if (!updated) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  })
  .delete("/users/:id", async (c) => {
    const denied = await gateCsAdmin(c.var.user.id);
    if (denied) return denied;
    const targetId = c.req.param("id");
    if (c.var.user.id === targetId) {
      return c.json({ error: "cannot_delete_self" }, 400);
    }
    const [deleted] = await db
      .delete(schema.users)
      .where(and(eq(schema.users.id, targetId), eq(schema.users.userType, "central_services")))
      .returning({ id: schema.users.id });
    if (!deleted) return c.json({ error: "not_found" }, 404);
    return c.json({ ok: true });
  });
