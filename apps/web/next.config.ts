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
};

export default config;
