import { db, orgScope, schema } from "@bgreen/db";
import type {
  Record,
  RecordStatus,
  RecordValues,
  ScoreBreakdownEntry,
} from "@bgreen/types";
import { and, desc, eq, inArray } from "drizzle-orm";
import type { RecordRepository } from "../application/record-service.js";

// V5.2 dropped `records.status`; the authoritative state lives on the
// matching workflow_instances row. We join + coalesce so the Record
// domain type continues to expose a flat `status` string.

const RECORD_STATUS_VALUES: ReadonlySet<RecordStatus> = new Set<RecordStatus>([
  "draft",
  "submitted",
  "approved",
  "changes_requested",
  "rejected",
]);

interface RecordWithStatusRow extends Omit<typeof schema.records.$inferSelect, never> {
  workflowState: unknown;
}

// Drizzle returns numeric as string to preserve precision; decode at
// the repo boundary so the rest of the app sees plain numbers.
function parseNumeric(value: string | null): number | null {
  if (value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function rowToRecord(row: RecordWithStatusRow): Record {
  return {
    id: row.id,
    organizationId: row.organizationId,
    templateId: row.templateId,
    status: deriveStatus(row.workflowState),
    values: row.values as RecordValues,
    reviewComment: row.reviewComment,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    submittedByUserId: row.submittedByUserId,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    reviewedByUserId: row.reviewedByUserId,
    score: parseNumeric(row.score),
    scorePercent: parseNumeric(row.scorePercent),
    scoreTier: row.scoreTier,
    scoreBreakdown: row.scoreBreakdown as ScoreBreakdownEntry[] | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// XState states for v1 workflow graphs map 1:1 onto the legacy
// RecordStatus enum. We coerce defensively in case a future graph
// emits a state name outside the v1 set.
function deriveStatus(raw: unknown): RecordStatus {
  if (typeof raw === "string" && (RECORD_STATUS_VALUES as Set<string>).has(raw)) {
    return raw as RecordStatus;
  }
  // certified maps to approved for the legacy display contract; review
  // queues and badges still show "approved" until the UI learns
  // certified-specific states in V5.3+.
  if (raw === "certified") return "approved";
  return "draft";
}

const selectColumns = {
  id: schema.records.id,
  organizationId: schema.records.organizationId,
  templateId: schema.records.templateId,
  values: schema.records.values,
  reviewComment: schema.records.reviewComment,
  submittedAt: schema.records.submittedAt,
  submittedByUserId: schema.records.submittedByUserId,
  reviewedAt: schema.records.reviewedAt,
  reviewedByUserId: schema.records.reviewedByUserId,
  score: schema.records.score,
  scorePercent: schema.records.scorePercent,
  scoreTier: schema.records.scoreTier,
  scoreBreakdown: schema.records.scoreBreakdown,
  createdAt: schema.records.createdAt,
  updatedAt: schema.records.updatedAt,
  workflowState: schema.workflowInstances.currentState,
};

function recordsWithStatus() {
  return db
    .select(selectColumns)
    .from(schema.records)
    .leftJoin(
      schema.workflowInstances,
      and(
        eq(schema.workflowInstances.entityKind, "record"),
        eq(schema.workflowInstances.entityId, schema.records.id),
      ),
    );
}

// Encode JS number → numeric-string for Drizzle's numeric columns.
// undefined ⇒ don't write the column at all (caller didn't supply a
// snapshot); null ⇒ explicit null (template without scoring, etc.).
function encodeNumeric(value: number | null | undefined): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return value.toFixed(4);
}

export class DrizzleRecordRepository implements RecordRepository {
  async insert(input: {
    organizationId: string;
    templateId: string;
    values: RecordValues;
    submittedAt: Date | null;
    submittedByUserId: string | null;
    score?: import("../application/record-service.js").ScoreSnapshotInput;
  }): Promise<Record> {
    const [row] = await db
      .insert(schema.records)
      .values({
        organizationId: input.organizationId,
        templateId: input.templateId,
        values: input.values,
        submittedAt: input.submittedAt,
        submittedByUserId: input.submittedByUserId,
        ...(input.score === undefined
          ? {}
          : {
              score: encodeNumeric(input.score.score),
              scorePercent: encodeNumeric(input.score.scorePercent),
              scoreTier: input.score.scoreTier,
              scoreBreakdown: input.score.scoreBreakdown,
            }),
      })
      .returning();
    if (!row) throw new Error("insert record: unexpected empty returning() result");
    // New row — workflow_instance is inserted by RecordService right
    // after; the join hasn't happened yet, so synthesise a draft state.
    return rowToRecord({ ...row, workflowState: "draft" });
  }

  async updateValues(input: {
    organizationId: string;
    recordId: string;
    values: RecordValues;
    submittedAt: Date | null;
    score?: import("../application/record-service.js").ScoreSnapshotInput;
  }): Promise<Record | null> {
    await db
      .update(schema.records)
      .set({
        values: input.values,
        submittedAt: input.submittedAt,
        updatedAt: new Date(),
        ...(input.score === undefined
          ? {}
          : {
              score: encodeNumeric(input.score.score),
              scorePercent: encodeNumeric(input.score.scorePercent),
              scoreTier: input.score.scoreTier,
              scoreBreakdown: input.score.scoreBreakdown,
            }),
      })
      .where(
        and(orgScope(schema.records, input.organizationId), eq(schema.records.id, input.recordId)),
      );
    return this.findById(input.organizationId, input.recordId);
  }

  async recordReview(input: {
    organizationId: string;
    recordId: string;
    reviewComment: string | null;
    reviewedAt: Date;
    reviewedByUserId: string;
  }): Promise<Record | null> {
    await db
      .update(schema.records)
      .set({
        reviewComment: input.reviewComment,
        reviewedAt: input.reviewedAt,
        reviewedByUserId: input.reviewedByUserId,
        updatedAt: new Date(),
      })
      .where(
        and(orgScope(schema.records, input.organizationId), eq(schema.records.id, input.recordId)),
      );
    return this.findById(input.organizationId, input.recordId);
  }

  async findById(organizationId: string, id: string): Promise<Record | null> {
    const rows = await recordsWithStatus()
      .where(and(orgScope(schema.records, organizationId), eq(schema.records.id, id)))
      .limit(1);
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  }

  async findAnyById(id: string): Promise<Record | null> {
    const rows = await recordsWithStatus().where(eq(schema.records.id, id)).limit(1);
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  }

  async findLatestSubmitted(organizationId: string, templateId: string): Promise<Record | null> {
    // Cross-template prefill consumes any "submitted" or "approved" state.
    // current_state is text since V12 (was jsonb scalar) — no cast needed.
    const rows = await recordsWithStatus()
      .where(
        and(
          orgScope(schema.records, organizationId),
          eq(schema.records.templateId, templateId),
          inArray(schema.workflowInstances.currentState, ["submitted", "approved", "certified"]),
        ),
      )
      .orderBy(desc(schema.records.submittedAt))
      .limit(1);
    const row = rows[0];
    return row ? rowToRecord(row) : null;
  }

  async listForUserInOrg(organizationId: string, userId: string): Promise<Record[]> {
    const rows = await recordsWithStatus()
      .where(
        and(orgScope(schema.records, organizationId), eq(schema.records.submittedByUserId, userId)),
      )
      .orderBy(desc(schema.records.createdAt));
    return rows.map(rowToRecord);
  }

  async listForOrganization(organizationId: string): Promise<Record[]> {
    const rows = await recordsWithStatus()
      .where(orgScope(schema.records, organizationId))
      .orderBy(desc(schema.records.createdAt));
    return rows.map(rowToRecord);
  }
}
