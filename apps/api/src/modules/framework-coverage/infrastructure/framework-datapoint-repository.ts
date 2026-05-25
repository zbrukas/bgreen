// V10.2 — read-only access to the framework_datapoints catalog.
//
// The catalog is reference data seeded by an apps/api script; no
// route writes to it (V11+ may add a CS-admin import flow). The
// repository surface is therefore minimal: list + filter by framework.

import { db, schema } from "@bgreen/db";
import type {
  Framework,
  FrameworkDatapoint,
  SectorApplicability,
} from "@bgreen/frameworks";
import { eq } from "drizzle-orm";

export interface FrameworkDatapointRepository {
  listAll(): Promise<FrameworkDatapoint[]>;
  listByFramework(framework: Framework): Promise<FrameworkDatapoint[]>;
}

type Row = typeof schema.frameworkDatapoints.$inferSelect;

function rowToDomain(row: Row): FrameworkDatapoint {
  return {
    id: row.id,
    framework: row.framework,
    topic: row.topic,
    code: row.code,
    title: row.title,
    description: row.description,
    sectorApplicability: row.sectorApplicability as SectorApplicability,
    version: row.version,
  };
}

export class DrizzleFrameworkDatapointRepository implements FrameworkDatapointRepository {
  async listAll(): Promise<FrameworkDatapoint[]> {
    const rows = await db.select().from(schema.frameworkDatapoints);
    return rows.map(rowToDomain);
  }

  async listByFramework(framework: Framework): Promise<FrameworkDatapoint[]> {
    const rows = await db
      .select()
      .from(schema.frameworkDatapoints)
      .where(eq(schema.frameworkDatapoints.framework, framework));
    return rows.map(rowToDomain);
  }
}
