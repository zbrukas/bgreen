import { validateNif } from "@bgreen/pt-data";
import { Hono } from "hono";
import type { AppEnv } from "../../../context.js";
import { viesClient } from "../../../services.js";

export const lookupsRoutes = new Hono<AppEnv>().get("/vies/:nif", async (c) => {
  const nif = c.req.param("nif");
  if (!nif) return c.json({ error: "missing_nif" }, 400);

  // Gate on NIF validity to avoid bouncing junk traffic off VIES.
  const validation = validateNif(nif);
  if (!validation.valid) {
    return c.json({ error: "invalid_nif", reason: validation.reason }, 400);
  }

  const result = await viesClient.lookup("PT", validation.normalized);
  if (!result) {
    return c.json({ valid: false, name: null, address: null, source: "unreachable" }, 200);
  }
  return c.json(
    {
      valid: result.valid,
      name: result.name,
      address: result.address,
      requestDate: result.requestDate,
      source: "vies",
    },
    200,
  );
});
