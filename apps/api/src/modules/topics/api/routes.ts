import { TopicSlugSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { canCsWrite } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { topicService } from "../../../services.js";

const createInput = z.object({
  slug: TopicSlugSchema,
  name: z.string().min(1).max(120),
});

// Topic reads are open to every authenticated user — org users need topic
// names to render template metadata. Writes require a CS admin/maintainer.
async function gateWrite(userId: string): Promise<Response | null> {
  return (await canCsWrite(userId))
    ? null
    : Response.json({ error: "central_services_required" }, { status: 403 });
}

export const topicsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    return c.json(await topicService.list());
  })
  .post("/", zValidator("json", createInput), async (c) => {
    const denied = await gateWrite(c.var.user.id);
    if (denied) return denied;
    const input = c.req.valid("json");
    const result = await topicService.create({
      slug: input.slug,
      name: input.name,
      createdByUserId: c.var.user.id,
    });
    if (!result.ok) return c.json({ error: result.code }, 409);
    return c.json(result.topic, 201);
  })
  .delete("/:id", async (c) => {
    const denied = await gateWrite(c.var.user.id);
    if (denied) return denied;
    await topicService.delete(c.req.param("id"));
    return c.json({ ok: true });
  });
