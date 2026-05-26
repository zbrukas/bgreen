import {
  CsOrgListOptionsSchema,
  LegalFormSchema,
  OrganizationSizeSchema,
} from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canCsRelation, canCsWrite } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { csOrgsService } from "../../../services.js";

// Any-CS-user gate. R + U are open to all three CS roles.
const gateCsRead = async (userId: string): Promise<Response | null> => {
  if (await canCsWrite(userId)) return null;
  if (await canCsRelation(userId, "promoter")) return null;
  return Response.json({ error: "central_services_required" }, { status: 403 });
};

// Delete gate. canCsWrite covers admin OR maintainer — promoter is
// publish-only and stays out of destructive ops on customer data.
const gateCsDelete = async (userId: string): Promise<Response | null> => {
  if (await canCsWrite(userId)) return null;
  return Response.json({ error: "central_services_write_required" }, { status: 403 });
};

const orgIdParam = z.object({ id: z.string().uuid() });

const updateOrgInput = z.object({
  name: z.string().min(1).max(200).optional(),
  nif: z.string().min(1).max(32).nullable().optional(),
  caeCode: z.string().min(1).max(16).nullable().optional(),
  legalForm: LegalFormSchema.nullable().optional(),
  selfReportedSize: OrganizationSizeSchema.nullable().optional(),
  postalCode: z.string().min(1).max(16).nullable().optional(),
  addressLine: z.string().min(1).max(500).nullable().optional(),
  freguesia: z.string().min(1).max(200).nullable().optional(),
  concelho: z.string().min(1).max(200).nullable().optional(),
  distrito: z.string().min(1).max(200).nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  brandPrimaryColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, "use #RRGGBB")
    .nullable()
    .optional(),
});

export const csOrgsRoutes = new Hono<AppEnv>()
  .get("/orgs", zValidator("query", CsOrgListOptionsSchema), async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const { items, total } = await csOrgsService.list(c.req.valid("query"));
    c.header("X-Total-Count", String(total));
    return c.json(items);
  })
  .get("/orgs/:id", zValidator("param", orgIdParam), async (c) => {
    const denied = await gateCsRead(c.var.user.id);
    if (denied) return denied;
    const { id } = c.req.valid("param");
    const detail = await csOrgsService.get(id);
    if (!detail) return c.json({ error: "not_found" }, 404);
    return c.json(detail);
  })
  .patch(
    "/orgs/:id",
    zValidator("param", orgIdParam),
    zValidator("json", updateOrgInput),
    async (c) => {
      const denied = await gateCsRead(c.var.user.id);
      if (denied) return denied;
      const { id } = c.req.valid("param");
      const patch = c.req.valid("json");
      const updated = await csOrgsService.update({
        organizationId: id,
        patch,
        actorUserId: c.var.user.id,
      });
      if (!updated) return c.json({ error: "not_found" }, 404);
      return c.json(updated);
    },
  )
  .delete("/orgs/:id", zValidator("param", orgIdParam), async (c) => {
    const denied = await gateCsDelete(c.var.user.id);
    if (denied) return denied;
    const { id } = c.req.valid("param");
    const result = await csOrgsService.delete({
      organizationId: id,
      actorUserId: c.var.user.id,
    });
    if (!result.deleted) return c.json({ error: "not_found" }, 404);
    return c.json(result);
  });
