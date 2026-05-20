import { db, orgScope, schema } from "@bgreen/db";
import type { Record, RecordValues } from "@bgreen/types";
import { and, desc, eq } from "drizzle-orm";
import type { RecordRepository } from "../application/record-service.js";

function rowToRecord(row: typeof schema.records.$inferSelect): Record {
  return {
    id: row.id,
    organizationId: row.organizationId,
    templateId: row.templateId,
    status: row.status,
    values: row.values as RecordValues,
    reviewComment: row.reviewComment,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    submittedByUserId: row.submittedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedByUserId: row.reviewedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class DrizzleRecordRepository implements RecordRepository {
  async insert(input: {
    organizationId: string;
    templateId: string;
    status: Record["status"];
    values: RecordValues;
    submittedAt: Date | null;
    submittedByUserId: string | null;
  }): Promise<Record> {
    const [row] = await db
      .insert(schema.records)
      .values({
        organizationId: input.organizationId,
        templateId: input.templateId,
        status: input.status,
        values: input.values,
        submittedAt: input.submittedAt,
        submittedByUserId: input.submittedByUserId,
      })
      .returning();
    if (!row) throw new Error("insert record: unexpected empty returning() result");
    return rowToRecord(row);
  }

  async updateValues(input: {
    organizationId: string;
    recordId: string;
    status: Record["status"];
    values: RecordValues;
    submittedAt: Date | null;
  }): Promise<Record | null> {
    const [row] = await db
      .update(schema.records)
      .set({
        status: input.status,
        values: input.values,
        submittedAt: input.submittedAt,
        updatedAt: new Date(),
      })
      .where(
        and(orgScope(schema.records, input.organizationId), eq(schema.records.id, input.recordId)),
      )
      .returning();
    return row ? rowToRecord(row) : null;
  }

  async recordReview(input: {
    organizationId: string;
    recordId: string;
    status: Record["status"];
    reviewComment: string | null;
    reviewedAt: Date;
    reviewedByUserId: string;
  }): Promise<Record | null> {
    const [row] = await db
      .update(schema.records)
      .set({
        status: input.status,
        reviewComment: input.reviewComment,
        reviewedAt: input.reviewedAt,
        reviewedByUserId: input.reviewedByUserId,
        updatedAt: new Date(),
      })
      .where(
        and(orgScope(schema.records, input.organizationId), eq(schema.records.id, input.recordId)),
      )
      .returning();
    return row ? rowToRecord(row) : null;
  }

  async findById(organizationId: string, id: string): Promise<Record | null> {
    const rows = await db
      .select()
      .from(schema.records)
      .where(and(orgScope(schema.records, organizationId), eq(schema.records.id, id)))
      .limit(1);
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  }

  async listForUserInOrg(organizationId: string, userId: string): Promise<Record[]> {
    const rows = await db
      .select()
      .from(schema.records)
      .where(
        and(orgScope(schema.records, organizationId), eq(schema.records.submittedByUserId, userId)),
      )
      .orderBy(desc(schema.records.createdAt));
    return rows.map(rowToRecord);
  }

  async listForOrganization(organizationId: string): Promise<Record[]> {
    const rows = await db
      .select()
      .from(schema.records)
      .where(orgScope(schema.records, organizationId))
      .orderBy(desc(schema.records.createdAt));
    return rows.map(rowToRecord);
  }
}
