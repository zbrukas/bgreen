import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { csAuthService } from "../../../services.js";

const loginInput = z.object({
  email: z.string().email().max(320),
  password: z.string().min(1).max(200),
});

const setupInput = z.object({
  email: z.string().email().max(320),
  newPassword: z.string().min(12).max(200),
});

// /cs/auth routes are unauthenticated by design: they sit on the
// "public" Hono branch so login can run before any Bearer header is
// present. The shape mirrors fetch-friendly JSON.
export const csAuthRoutes = new Hono()
  .post("/login", zValidator("json", loginInput), async (c) => {
    const input = c.req.valid("json");
    const result = await csAuthService.login(input);
    if (result.ok) return c.json({ token: result.token, user: result.user });
    if (result.code === "password_setup_required") {
      return c.json({ error: result.code, userId: result.userId }, 409);
    }
    if (result.code === "not_a_cs_user") return c.json({ error: result.code }, 403);
    return c.json({ error: result.code }, 401);
  })
  .post("/setup-password", zValidator("json", setupInput), async (c) => {
    const input = c.req.valid("json");
    const result = await csAuthService.setupPassword(input);
    if (result.ok) return c.json({ token: result.token, user: result.user });
    if (result.code === "user_not_found") return c.json({ error: result.code }, 404);
    if (result.code === "not_a_cs_user") return c.json({ error: result.code }, 403);
    return c.json({ error: result.code }, 409);
  })
  // Stateless tokens — logout is a client-side cookie clear. Keeping
  // the endpoint so the CS app has something to POST to; reserves space
  // for a future revocation list.
  .post("/logout", (c) => c.json({ ok: true }));
