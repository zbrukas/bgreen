import "./setup.js"; // loads .env from repo root before anything else runs

import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { ensureGlobalAdmin } from "./seed-global-admin.js";

const port = Number(process.env.PORT ?? 8787);

// Fire-and-log the seed: don't block boot if it fails — the API still
// serves and the global admin can be promoted via direct DB later.
ensureGlobalAdmin().catch((err) => {
  console.warn("seed-global-admin failed:", err);
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`apps/api listening on http://localhost:${info.port}`);
});
