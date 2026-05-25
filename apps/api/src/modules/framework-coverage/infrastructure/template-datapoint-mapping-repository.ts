// V10.2 — CRUD for the CS-managed template ↔ datapoint mapping.
//
// Inserts use ON CONFLICT DO NOTHING so re-adding the same (template,
// datapoint) pair is idempotent. Deletes are by primary key (mapping
// id) so the route layer can reference a specific row.

import { db, schema } from "@bgreen/db";
import { and, eq } from "drizzle-orm";
import type { TemplateDatapointMapping } from "../domain/types.js";

export interface TemplateDatapointMappingRepository {
  insert(input: {
    templateId: string;
    frameworkDatapointId: string;
    createdByUserId: string;
  }): Promise<TemplateDatapointMapping>;
  deleteById(id: string): Promise<TemplateDatapointMapping | null>;
  findById(id: string): Promise<TemplateDatapointMapping | null>;
  findByPair(
    templateId: string,
    frameworkDatapointId: string,
  ): Promise<TemplateDatapointMapping | null>;
  listAll(): Promise<TemplateDatapointMapping[]>;
}

type Row = typeof schema.templateDatapointMappings.$inferSelect;

function rowToDomain(row: Row): TemplateDatapointMapping {
  return {
    id: row.id,
    templateId: row.templateId,
    frameworkDatapointId: row.frameworkDatapointId,
    createdByUserId: row.createdByUserId,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleTemplateDatapointMappingRepository
  implements TemplateDatapointMappingRepository
{
  async insert(input: {
    templateId: string;
    frameworkDatapointId: string;
    createdByUserId: string;
  }): Promise<TemplateDatapointMapping> {
    // ON CONFLICT DO NOTHING + a follow-up SELECT keeps the returning()
    // shape stable for both fresh inserts and idempotent re-adds.
    const inserted = await db
      .insert(schema.templateDatapointMappings)
      .values({
        templateId: input.templateId,
        frameworkDatapointId: input.frameworkDatapointId,
        createdByUserId: input.createdByUserId,
      })
      .onConflictDoNothing({
        target: [
          schema.templateDatapointMappings.templateId,
          schema.templateDatapointMappings.frameworkDatapointId,
        ],
      })
      .returning();
    const row =
      inserted[0] ??
      (await this.findByPairRaw(input.templateId, input.frameworkDatapointId));
    if (!row) throw new Error("insert template_datapoint_mappings: no row returned");
    return rowToDomain(row);
  }

  async deleteById(id: string): Promise<TemplateDatapointMapping | null> {
    const deleted = await db
      .delete(schema.templateDatapointMappings)
      .where(eq(schema.templateDatapointMappings.id, id))
      .returning();
    const row = deleted[0];
    return row ? rowToDomain(row) : null;
  }

  async findById(id: string): Promise<TemplateDatapointMapping | null> {
    const rows = await db
      .select()
      .from(schema.templateDatapointMappings)
      .where(eq(schema.templateDatapointMappings.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToDomain(row) : null;
  }

  async findByPair(
    templateId: string,
    frameworkDatapointId: string,
  ): Promise<TemplateDatapointMapping | null> {
    const row = await this.findByPairRaw(templateId, frameworkDatapointId);
    return row ? rowToDomain(row) : null;
  }

  async listAll(): Promise<TemplateDatapointMapping[]> {
    const rows = await db.select().from(schema.templateDatapointMappings);
    return rows.map(rowToDomain);
  }

  private async findByPairRaw(
    templateId: string,
    frameworkDatapointId: string,
  ): Promise<Row | undefined> {
    const rows = await db
      .select()
      .from(schema.templateDatapointMappings)
      .where(
        and(
          eq(schema.templateDatapointMappings.templateId, templateId),
          eq(schema.templateDatapointMappings.frameworkDatapointId, frameworkDatapointId),
        ),
      )
      .limit(1);
    return rows[0];
  }
}
