import { validateNif } from "@bgreen/pt-data";
import { Hono } from "hono";
import type { AppEnv } from "../../../context.js";
import { viesClient } from "../../../services.js";
import { findCaeByCode, listAllCaes, searchCae } from "../application/cae.js";
import { lookupPostalCode, normalizePostalCode } from "../application/postal-codes.js";

export const lookupsRoutes = new Hono<AppEnv>()
  .get("/cae", async (c) => {
    const q = c.req.query("q") ?? "";
    const rawLimit = c.req.query("limit");
    const limit = rawLimit ? Number(rawLimit) : 20;
    const results = await searchCae(q, Number.isFinite(limit) ? limit : 20);
    return c.json(results);
  })
  .get("/caes", async (c) => {
    const results = await listAllCaes();
    return c.json(results);
  })
  .get("/cae/:code", async (c) => {
    const code = c.req.param("code");
    if (!code) return c.json({ error: "missing_code" }, 400);
    const entry = await findCaeByCode(code);
    if (!entry) return c.json({ error: "not_found" }, 404);
    return c.json(entry);
  })
  .get("/postal-code/:cp", async (c) => {
    const cp = c.req.param("cp");
    if (!cp) return c.json({ error: "missing_postal_code" }, 400);
    const normalized = normalizePostalCode(cp);
    if (!normalized) return c.json({ error: "invalid_postal_code" }, 400);

    const entry = await lookupPostalCode(normalized);
    if (!entry) {
      return c.json({ postalCode: normalized, found: false }, 200);
    }
    return c.json(
      {
        postalCode: entry.postalCode,
        found: true,
        freguesia: entry.freguesia,
        concelho: entry.concelho,
        distrito: entry.distrito,
      },
      200,
    );
  })
  .get("/vies/:nif", async (c) => {
    const nif = c.req.param("nif");
    if (!nif) return c.json({ error: "missing_nif" }, 400);

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
