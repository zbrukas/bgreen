import { LegalFormSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../../context.js";
import { organizationService } from "../../../services.js";

const createOrganizationInput = z.object({
  name: z.string().min(1).max(200),
  legalForm: LegalFormSchema.nullable().optional(),
});

export const organizationsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const orgs = await organizationService.listOrganizationsForUser(c.var.user.id);
    return c.json(orgs);
  })
  .post("/", zValidator("json", createOrganizationInput), async (c) => {
    const input = c.req.valid("json");
    const result = await organizationService.createWithOwner({
      ownerUserId: c.var.user.id,
      name: input.name,
      legalForm: input.legalForm ?? null,
    });
    return c.json(result, 201);
  });
