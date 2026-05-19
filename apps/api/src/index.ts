import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Inngest } from "inngest";
import { serve as inngestServe } from "inngest/hono";

const inngest = new Inngest({ id: "bgreen-api" });

const app = new Hono();

app.get("/health", (c) => c.json({ status: "ok", service: "api" }));

app.on(["GET", "POST", "PUT"], "/api/inngest", inngestServe({ client: inngest, functions: [] }));

const port = Number(process.env.PORT ?? 8787);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`apps/api listening on http://localhost:${info.port}`);
});
