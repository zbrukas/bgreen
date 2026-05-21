// Adapter that bridges the FgaClient port from @bgreen/auth to the
// WorkOS SDK. Lives in apps/api (the place that already imports the
// SDK) so packages/auth stays SDK-free and unit-testable.

import type { FgaClient } from "@bgreen/auth";
import { WorkOS } from "@workos-inc/node";

let _client: FgaClient | null = null;
let _workos: WorkOS | null = null;

function workos(): WorkOS {
  if (_workos) return _workos;
  const apiKey = process.env.WORKOS_API_KEY;
  if (!apiKey) {
    throw new Error("WORKOS_API_KEY env var is required for FGA");
  }
  _workos = new WorkOS(apiKey);
  return _workos;
}

export function getFgaClient(): FgaClient {
  if (_client) return _client;
  _client = {
    async check(input) {
      const res = await workos().fga.check({
        checks: [
          {
            resource: input.resource,
            relation: input.relation,
            subject: input.subject,
          },
        ],
      });
      return res.isAuthorized();
    },
    async writeWarrant(input) {
      await workos().fga.writeWarrant({
        resource: input.resource,
        relation: input.relation,
        subject: input.subject,
      });
    },
  };
  return _client;
}
