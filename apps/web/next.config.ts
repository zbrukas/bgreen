import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadDotenv } from "dotenv";
import type { NextConfig } from "next";

// Load .env from the monorepo root so apps/web and apps/api share a single
// source of truth. Next.js's own .env.local handling still works as a fallback.
const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, "../../.env") });

const config: NextConfig = {
  reactStrictMode: true,
  // Keep the file watcher off heavy reference data sitting in the workspace.
  // The 27MB CSV and 12MB JSON in @bgreen/pt-data don't need to trigger
  // rebuilds (or to be opened at all) during dev.
  webpack: (cfg) => {
    cfg.watchOptions = {
      ...cfg.watchOptions,
      ignored: [
        "**/node_modules/**",
        "**/packages/pt-data/raw/**",
        "**/packages/pt-data/src/cae-data.json",
        "**/packages/pt-data/src/postal-codes-data.json",
        "**/packages/db/migrations/**",
      ],
    };
    return cfg;
  },
};

export default config;
