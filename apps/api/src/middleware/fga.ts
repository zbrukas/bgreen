// Hono middleware that wraps each request in an FGA cache scope and
// catches FgaDeniedError thrown by services/routes, mapping it to 403.

import { FgaDeniedError, runWithCache } from "@bgreen/auth";
import { createMiddleware } from "hono/factory";
import type { AppEnv } from "../context.js";

export const fgaMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  await runWithCache(async () => {
    try {
      await next();
    } catch (err) {
      if (err instanceof FgaDeniedError) {
        c.res = c.json(
          {
            error: "forbidden",
            relation: err.args.action,
            resource: err.args.resource,
          },
          403,
        );
        return;
      }
      throw err;
    }
  });
});
