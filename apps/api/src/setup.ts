import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";

// Load .env from the monorepo root. Runs as the first import in src/index.ts
// so env vars are populated before any other module evaluates.
const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, "../../../.env") });
