import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema/index.js";

const { Pool } = pg;

const connectionString =
  process.env.DATABASE_URL ?? "postgres://bgreen:bgreen_dev@localhost:5432/bgreen";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool, { schema });

export { schema };
