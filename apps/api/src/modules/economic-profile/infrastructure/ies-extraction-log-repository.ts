import { db, orgScope, schema } from "@bgreen/db";
import { and, eq } from "drizzle-orm";
import type {
  ExtractedEconomicProfile,
  IesExtractionLog,
  IesExtractionStatus,
  ValidatorWarning,
} from "../domain/types.js";

// Repository port consumed by IesExtractionService + (V6.4) the upload
// routes. Tenant-scoped on every read; the one find-without-scope below
// is for the Inngest function which arrives with only an id and looks up
// the row's org before doing anything sensitive.

export interface IesExtractionLogRepository {
  insert(input: {
    organizationId: string;
    uploadedByUserId: string | null;
    s3Key: string;
    originalFilename: string;
    fileSizeBytes: number;
  }): Promise<IesExtractionLog>;

  // Used by the Inngest function entrypoint — gets the log by id with
  // no tenant filter (Inngest events carry only ids; the function
  // resolves org context from the row itself).
  findAnyById(id: string): Promise<IesExtractionLog | null>;

  findById(organizationId: string, id: string): Promise<IesExtractionLog | null>;

  // Partial updates. Service layer decides which fields to bump per step.
  update(
    id: string,
    fields: Partial<{
      status: IesExtractionStatus;
      startedAt: Date | null;
      completedAt: Date | null;
      year: number | null;
      classificationResult: unknown;
      extractionResult: ExtractedEconomicProfile | null;
      validatorWarnings: ValidatorWarning[] | null;
      errorMessage: string | null;
      inngestRunId: string | null;
      s3Key: string | null;
      s3DeletedAt: Date | null;
    }>,
  ): Promise<IesExtractionLog | null>;
}

type Row = typeof schema.iesExtractionLogs.$inferSelect;

function rowToLog(row: Row): IesExtractionLog {
  return {
    id: row.id,
    organizationId: row.organizationId,
    uploadedByUserId: row.uploadedByUserId,
    s3Key: row.s3Key,
    s3DeletedAt: row.s3DeletedAt ? row.s3DeletedAt.toISOString() : null,
    originalFilename: row.originalFilename,
    fileSizeBytes: row.fileSizeBytes,
    status: row.status,
    year: row.year,
    classificationResult: row.classificationResult,
    extractionResult: row.extractionResult as ExtractedEconomicProfile | null,
    validatorWarnings: row.validatorWarnings as ValidatorWarning[] | null,
    errorMessage: row.errorMessage,
    inngestRunId: row.inngestRunId,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

export class DrizzleIesExtractionLogRepository implements IesExtractionLogRepository {
  async insert(input: {
    organizationId: string;
    uploadedByUserId: string | null;
    s3Key: string;
    originalFilename: string;
    fileSizeBytes: number;
  }): Promise<IesExtractionLog> {
    const [row] = await db
      .insert(schema.iesExtractionLogs)
      .values({
        organizationId: input.organizationId,
        uploadedByUserId: input.uploadedByUserId,
        s3Key: input.s3Key,
        originalFilename: input.originalFilename,
        fileSizeBytes: input.fileSizeBytes,
        status: "pending",
      })
      .returning();
    if (!row) throw new Error("insert ies_extraction_logs: empty returning() result");
    return rowToLog(row);
  }

  async findAnyById(id: string): Promise<IesExtractionLog | null> {
    const rows = await db
      .select()
      .from(schema.iesExtractionLogs)
      .where(eq(schema.iesExtractionLogs.id, id))
      .limit(1);
    const row = rows[0];
    return row ? rowToLog(row) : null;
  }

  async findById(organizationId: string, id: string): Promise<IesExtractionLog | null> {
    const rows = await db
      .select()
      .from(schema.iesExtractionLogs)
      .where(
        and(
          orgScope(schema.iesExtractionLogs, organizationId),
          eq(schema.iesExtractionLogs.id, id),
        ),
      )
      .limit(1);
    const row = rows[0];
    return row ? rowToLog(row) : null;
  }

  async update(
    id: string,
    fields: Partial<{
      status: IesExtractionStatus;
      startedAt: Date | null;
      completedAt: Date | null;
      year: number | null;
      classificationResult: unknown;
      extractionResult: ExtractedEconomicProfile | null;
      validatorWarnings: ValidatorWarning[] | null;
      errorMessage: string | null;
      inngestRunId: string | null;
      s3Key: string | null;
      s3DeletedAt: Date | null;
    }>,
  ): Promise<IesExtractionLog | null> {
    // Map domain fields to schema columns. JSONB fields go in as objects;
    // Drizzle serializes for us.
    const set: Record<string, unknown> = {};
    if (fields.status !== undefined) set.status = fields.status;
    if (fields.startedAt !== undefined) set.startedAt = fields.startedAt;
    if (fields.completedAt !== undefined) set.completedAt = fields.completedAt;
    if (fields.year !== undefined) set.year = fields.year;
    if (fields.classificationResult !== undefined)
      set.classificationResult = fields.classificationResult;
    if (fields.extractionResult !== undefined) set.extractionResult = fields.extractionResult;
    if (fields.validatorWarnings !== undefined) set.validatorWarnings = fields.validatorWarnings;
    if (fields.errorMessage !== undefined) set.errorMessage = fields.errorMessage;
    if (fields.inngestRunId !== undefined) set.inngestRunId = fields.inngestRunId;
    if (fields.s3Key !== undefined) set.s3Key = fields.s3Key;
    if (fields.s3DeletedAt !== undefined) set.s3DeletedAt = fields.s3DeletedAt;
    if (Object.keys(set).length === 0) return this.findAnyById(id);
    await db.update(schema.iesExtractionLogs).set(set).where(eq(schema.iesExtractionLogs.id, id));
    return this.findAnyById(id);
  }
}
