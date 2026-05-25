// V10.1 — seed `framework_datapoints` from the @bgreen/frameworks
// catalog. Idempotent: upserts on `id`. Re-running the seed picks up
// title/description edits + new datapoints in the catalog.
//
// Run via: pnpm --filter @bgreen/api seed-framework-datapoints

import "../src/setup.js";

import { db, pool, schema } from "@bgreen/db";
import { ALL_FRAMEWORK_DATAPOINTS } from "@bgreen/frameworks";
import { sql } from "drizzle-orm";

async function main(): Promise<void> {
  const rows = ALL_FRAMEWORK_DATAPOINTS.map((dp) => ({
    id: dp.id,
    framework: dp.framework,
    topic: dp.topic,
    code: dp.code,
    title: dp.title,
    description: dp.description,
    sectorApplicability: dp.sectorApplicability,
    version: dp.version,
    updatedAt: new Date(),
  }));
  console.log(`Seeding ${rows.length} framework_datapoints rows…`);

  await db
    .insert(schema.frameworkDatapoints)
    .values(rows)
    .onConflictDoUpdate({
      target: schema.frameworkDatapoints.id,
      set: {
        framework: sql`excluded.framework`,
        topic: sql`excluded.topic`,
        code: sql`excluded.code`,
        title: sql`excluded.title`,
        description: sql`excluded.description`,
        sectorApplicability: sql`excluded.sector_applicability`,
        version: sql`excluded.version`,
        updatedAt: sql`excluded.updated_at`,
      },
    });

  console.log(`done — ${rows.length} datapoints ensured`);
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(err);
    await pool.end();
    process.exit(1);
  });
