// Shared Inngest client. One per process so functions and event senders
// agree on app id + EU region settings.
//
// Functions register against this client (`inngest.createFunction(...)`)
// and the Hono `inngestServe()` handler exposes them at /api/inngest.
// `inngest.send(...)` from anywhere in apps/api enqueues events that the
// dev server (or prod Inngest) routes to the right function.

import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "bgreen-api" });
