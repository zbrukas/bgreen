import type { AppType } from "@bgreen/api/rpc";
import { hc } from "hono/client";

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787";

export const api = hc<AppType>(apiBaseUrl);
