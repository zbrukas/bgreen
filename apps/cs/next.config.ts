import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";

// Load .env from the monorepo root so all three apps share a single
// source of truth.
const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, "../../.env") });

const config: NextConfig = {
  reactStrictMode: true,
};

export default config;
