import type { FormError, ValidationMode } from "@bgreen/form-engine";
import { validateComposedFormValues, validateFormValues } from "@bgreen/form-engine";
import { computeScore } from "@bgreen/scoring";
import type { Record, RecordSummary, RecordTemplate, RecordValues } from "@bgreen/types";
import type { AuditService } from "../../audit/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import type { TopicRepository } from "../../topics/module.js";
import type { WorkflowService } from "../../workflows/application/workflow-service.js";
// Pulled from the graphs deep-export (not the workflows module barrel)
// so test files that import this service don't transitively load
// workflows/api/routes.ts → services.ts at module-resolution time.
import { defaultWorkflowDefinitionId } from "../../workflows/graphs/index.js";

export interface CreateRecordInput {
  organizationId: string;
  templateId: string;
  rawValues: unknown;
  submitterUserId: string;
  asDraft?: boolean;
  // V5.6: actor's topic scope. Empty array = no restriction. Non-empty
  // filters which composed sub-templates the actor may write to and
  // which require validation here.
  actorTopicScope?: string[];
}

export interface UpdateRecordInput {
  organizationId: string;
  recordId: string;
  rawValues: unknown;
  actorUserId: string;
  // "save_draft" leaves the record in draft state; "submit" promotes it.
  action: "save_draft" | "submit";
  // V5.6: actor's topic scope (same semantics as CreateRecordInput).
  actorTopicScope?: string[];
}

// V8.2 — score snapshot passed through to insert / updateValues. Null
// inside when the template has no scoring metadata. The repository
// stores it verbatim; the service computes the values via @bgreen/scoring
// before calling.
export interface ScoreSnapshotInput {
  score: number | null;
  scorePercent: number | null;
  scoreTier: string | null;
  scoreBreakdown: import("@bgreen/types").ScoreBreakdownEntry[] | null;
}

export interface RecordRepository {
  insert(input: {
    organizationId: string;
    templateId: string;
    values: RecordValues;
    submittedAt: Date | null;
    submittedByUserId: string | null;
    score?: ScoreSnapshotInput;
  }): Promise<Record>;
  updateValues(input: {
    organizationId: string;
    recordId: string;
    values: RecordValues;
    submittedAt: Date | null;
    score?: ScoreSnapshotInput;
  }): Promise<Record | null>;
  recordReview(input: {
    organizationId: string;
    recordId: string;
    reviewComment: string | null;
    reviewedAt: Date;
    reviewedByUserId: string;
  }): Promise<Record | null>;
  findById(organizationId: string, id: string): Promise<Record | null>;
  findLatestSubmitted(organizationId: string, templateId: string): Promise<Record | null>;
  // List paths return the slim projection — JSONB values + scoreBreakdown
  // are omitted because no current consumer reads them and they are by
  // far the heaviest columns on the wire. See plans/db-performance M2.
  listForUserInOrg(organizationId: string, userId: string): Promise<RecordSummary[]>;
  listForOrganization(organizationId: string): Promise<RecordSummary[]>;
}

export type SubmitResult =
  | { ok: true; record: Record }
  | { ok: false; code: "template_not_found" | "template_not_published" }
  | { ok: false; code: "validation_failed"; errors: FormError[] };

export type UpdateResult =
  | { ok: true; record: Record }
  | {
      ok: false;
      code:
        | "record_not_found"
        | "template_not_found"
        | "template_not_published"
        | "forbidden"
        | "not_editable";
    }
  | { ok: false; code: "validation_failed"; errors: FormError[] };

export type ReviewDecision = "approve" | "request_changes" | "reject";

export interface ReviewRecordInput {
  organizationId: string;
  recordId: string;
  reviewerUserId: string;
  decision: ReviewDecision;
  comment: string | null;
}

export type ReviewResult =
  | { ok: true; record: Record }
  | {
      ok: false;
      code: "record_not_found" | "not_reviewable" | "comment_required";
    };

// V8.2 — dashboard wire shape. One entry per template the org has
// scored at least one record against; scores ascending by submittedAt.
export interface RecordScorePoint {
  recordId: string;
  total: number;
  percent: number;
  tier: string;
  submittedAt: string;
}

export interface TemplateScoreHistory {
  templateId: string;
  templateName: string;
  scores: RecordScorePoint[];
}

export class RecordService {
  constructor(
    private readonly records: RecordRepository,
    private readonly templates: RecordTemplateRepository,
    private readonly audit: AuditService,
    private readonly workflows: WorkflowService,
    // V5.6: needed to resolve sub-template topicTagId → slug for scope
    // filtering. List() is called at most once per submit/update.
    private readonly topics: TopicRepository,
  ) {}

  async submit(input: CreateRecordInput): Promise<SubmitResult> {
    const template = await this.templates.findById(input.templateId);
    if (!template) return { ok: false, code: "template_not_found" };
    if (!input.asDraft && template.status !== "published") {
      return { ok: false, code: "template_not_published" };
    }

    const mode: ValidationMode = input.asDraft ? "draft" : "submit";
    const validated = await this.validateAgainstTemplate(
      template,
      input.rawValues,
      mode,
      input.actorTopicScope ?? [],
    );
    if (!validated.ok) {
      return { ok: false, code: "validation_failed", errors: validated.errors };
    }

    // V8.2 — compute the score snapshot on actual submit. Drafts skip
    // scoring (the values aren't authoritative yet); templates without
    // a `scoring` block return null from the engine and we persist null.
    const score = input.asDraft
      ? undefined
      : buildScoreSnapshot(template, validated.values);

    // Insert the record row. Workflow instance is created right after;
    // status lives on the workflow_instance, not the record row.
    const record = await this.records.insert({
      organizationId: input.organizationId,
      templateId: input.templateId,
      values: validated.values,
      submittedAt: input.asDraft ? null : new Date(),
      submittedByUserId: input.submitterUserId,
      score,
    });

    // Start the workflow chosen by the template (defaults to two-step-review).
    const definitionId = template.workflowDefinitionId ?? defaultWorkflowDefinitionId;
    await this.workflows.start({
      organizationId: input.organizationId,
      entityKind: "record",
      entityId: record.id,
      definitionId,
      actorUserId: input.submitterUserId,
    });

    if (input.asDraft) {
      // Drafts stay in the initial state. Workflow.started covers the
      // visible audit entry; add a record.draft_created for parity with
      // V5.1 history rendering.
      await this.audit.record({
        actorUserId: input.submitterUserId,
        organizationId: input.organizationId,
        entityKind: "record",
        entityId: record.id,
        action: "record.draft_created",
        payload: { templateId: record.templateId },
      });
    } else {
      // Submit-direct: drive the workflow to the submitted state.
      await this.workflows.send({
        organizationId: input.organizationId,
        entityKind: "record",
        entityId: record.id,
        event: { type: "submit", actorUserId: input.submitterUserId },
      });
    }

    return { ok: true, record };
  }

  async update(input: UpdateRecordInput): Promise<UpdateResult> {
    const existing = await this.records.findById(input.organizationId, input.recordId);
    if (!existing) return { ok: false, code: "record_not_found" };
    if (existing.submittedByUserId !== input.actorUserId) {
      return { ok: false, code: "forbidden" };
    }
    // Drafts can be edited freely; records returned with changes_requested
    // can be re-edited and resubmitted by the original submitter.
    if (existing.status !== "draft" && existing.status !== "changes_requested") {
      return { ok: false, code: "not_editable" };
    }

    const template = await this.templates.findById(existing.templateId);
    if (!template) return { ok: false, code: "template_not_found" };
    if (input.action === "submit" && template.status !== "published") {
      return { ok: false, code: "template_not_published" };
    }

    const mode: ValidationMode = input.action === "submit" ? "submit" : "draft";
    const validated = await this.validateAgainstTemplate(
      template,
      input.rawValues,
      mode,
      input.actorTopicScope ?? [],
    );
    if (!validated.ok) {
      return { ok: false, code: "validation_failed", errors: validated.errors };
    }

    // V5.6: out-of-scope subs on the existing record are preserved as-is.
    // The actor can't see or write them; merging here is the only way to
    // avoid clobbering work by collaborators with the matching scope.
    const valuesToStore =
      validated.outOfScopeSubIds.length > 0
        ? mergePreservedSubs(validated.values, existing.values, validated.outOfScopeSubIds)
        : validated.values;

    const submittedAt =
      input.action === "submit"
        ? new Date()
        : existing.submittedAt
          ? new Date(existing.submittedAt)
          : null;
    // V8.2 — recompute score on re-submit. Save-as-draft keeps the
    // existing score row (the values haven't been validated as a
    // submission yet); we don't pass a snapshot so the columns stay
    // untouched.
    const score =
      input.action === "submit" ? buildScoreSnapshot(template, valuesToStore) : undefined;
    const record = await this.records.updateValues({
      organizationId: input.organizationId,
      recordId: input.recordId,
      values: valuesToStore,
      submittedAt,
      score,
    });
    if (!record) return { ok: false, code: "record_not_found" };

    if (input.action === "submit") {
      await this.workflows.send({
        organizationId: input.organizationId,
        entityKind: "record",
        entityId: record.id,
        event: { type: "submit", actorUserId: input.actorUserId },
      });
    } else {
      // save_draft has no workflow transition — log the values edit only.
      await this.audit.record({
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        entityKind: "record",
        entityId: record.id,
        action: "record.draft_updated",
        payload: { fromStatus: existing.status, toStatus: record.status },
      });
    }
    return { ok: true, record };
  }

  async review(input: ReviewRecordInput): Promise<ReviewResult> {
    const existing = await this.records.findById(input.organizationId, input.recordId);
    if (!existing) return { ok: false, code: "record_not_found" };
    if (existing.status !== "submitted") {
      return { ok: false, code: "not_reviewable" };
    }
    const trimmed = input.comment?.trim() ?? "";
    if (input.decision !== "approve" && trimmed === "") {
      return { ok: false, code: "comment_required" };
    }

    // status lives on the workflow_instance; the review repo write only
    // touches the denormalised review-tracking columns on records.
    const record = await this.records.recordReview({
      organizationId: input.organizationId,
      recordId: input.recordId,
      reviewComment: trimmed === "" ? null : trimmed,
      reviewedAt: new Date(),
      reviewedByUserId: input.reviewerUserId,
    });
    if (!record) return { ok: false, code: "record_not_found" };

    // Drive the workflow with the decision event. Guards on the graph
    // (e.g., reviewer ≠ submitter) reject self-reviews independently of
    // any FGA role.
    const event =
      input.decision === "approve"
        ? { type: "approve" as const, actorUserId: input.reviewerUserId, comment: trimmed || null }
        : input.decision === "request_changes"
          ? {
              type: "request_changes" as const,
              actorUserId: input.reviewerUserId,
              comment: trimmed,
            }
          : { type: "reject" as const, actorUserId: input.reviewerUserId, comment: trimmed };
    const transition = await this.workflows.send({
      organizationId: input.organizationId,
      entityKind: "record",
      entityId: record.id,
      event,
    });
    if (!transition.ok) {
      // Should be unreachable in v1 — the record-level status check above
      // is strictly looser than the graph's guards. Log defensively.
      // biome-ignore lint/suspicious/noConsole: defensive log for impossible branch
      console.warn("workflow transition rejected after status write", {
        recordId: record.id,
        decision: input.decision,
        reason: transition.code,
      });
    }
    return { ok: true, record };
  }

  // Computes pre-fill values for a new draft against `templateId`. Walks
  // the template's fields and, for each one with a sourceMapping, finds
  // the most-recent submitted record of the referenced source template
  // (same org) and copies the value of the source field. Returns only the
  // fields that successfully prefilled.
  async computePrefill(
    organizationId: string,
    templateId: string,
  ): Promise<{ values: RecordValues } | { error: "template_not_found" }> {
    const template = await this.templates.findById(templateId);
    if (!template) return { error: "template_not_found" };

    const out: RecordValues = {};
    const latestBySource = new Map<string, Record | null>();

    for (const row of template.formSchema.rows) {
      for (const field of row.fields) {
        if (field.kind === "repeating") continue;
        const mapping = field.sourceMapping;
        if (!mapping) continue;

        // Cache per source template — multiple fields may map from the
        // same template.
        let source = latestBySource.get(mapping.sourceTemplateId);
        if (source === undefined) {
          source = await this.records.findLatestSubmitted(organizationId, mapping.sourceTemplateId);
          latestBySource.set(mapping.sourceTemplateId, source);
        }
        if (!source) continue;

        const value = source.values[mapping.sourceFieldId];
        if (value === undefined || value === null || value === "") continue;
        out[field.id] = value;
      }
    }

    return { values: out };
  }

  get(organizationId: string, id: string): Promise<Record | null> {
    return this.records.findById(organizationId, id);
  }

  listMine(organizationId: string, userId: string): Promise<RecordSummary[]> {
    return this.records.listForUserInOrg(organizationId, userId);
  }

  listAll(organizationId: string): Promise<RecordSummary[]> {
    return this.records.listForOrganization(organizationId);
  }

  // V8.2 — per-template score history for the dashboard. Drafts and
  // records without a score (template without scoring metadata) are
  // excluded. Scores are returned ascending by submittedAt so the
  // dashboard sparkline reads left-to-right.
  async listScoresGroupedByTemplate(organizationId: string): Promise<TemplateScoreHistory[]> {
    const records = await this.records.listForOrganization(organizationId);
    const byTemplate = new Map<string, RecordScorePoint[]>();
    for (const r of records) {
      if (r.score === null || r.scorePercent === null || r.scoreTier === null) continue;
      if (!r.submittedAt) continue;
      const points = byTemplate.get(r.templateId) ?? [];
      points.push({
        recordId: r.id,
        total: r.score,
        percent: r.scorePercent,
        tier: r.scoreTier,
        submittedAt: r.submittedAt,
      });
      byTemplate.set(r.templateId, points);
    }
    if (byTemplate.size === 0) return [];

    // Batched template name resolution. One round-trip for every
    // template appearing in the grouping (H5 in plans/db-performance).
    const templates = await this.templates.findByIds([...byTemplate.keys()]);
    const namesById = new Map(templates.map((t) => [t.id, t.name]));
    const out: TemplateScoreHistory[] = [];
    for (const [templateId, points] of byTemplate) {
      const templateName = namesById.get(templateId);
      if (!templateName) continue;
      points.sort((a, b) => a.submittedAt.localeCompare(b.submittedAt));
      out.push({ templateId, templateName, scores: points });
    }
    return out;
  }

  // Picks the plain or composed validator based on whether the template
  // declares any sub-templates. Sub-template schemas are fetched lazily;
  // a missing one is skipped silently — the composition row is the
  // source of truth, and a stale id won't block a submission.
  //
  // V5.6: actorTopicScope filters which sub-templates the actor can
  // touch. Out-of-scope subs are dropped from the validation set; if
  // the incoming payload references one, we 422 with a clear error so
  // a topic-scoped UI never silently overwrites someone else's data.
  // outOfScopeSubIds is reported back so the caller can merge the
  // existing record's values for those slots on update.
  private async validateAgainstTemplate(
    template: RecordTemplate,
    rawValues: unknown,
    mode: ValidationMode,
    actorTopicScope: string[],
  ): Promise<
    | { ok: true; values: RecordValues; outOfScopeSubIds: string[] }
    | { ok: false; errors: FormError[] }
  > {
    const subIds = template.composedSubTemplateIds;
    if (!subIds || subIds.length === 0) {
      const r = validateFormValues(template.formSchema, rawValues, { mode });
      if (!r.ok) return r;
      return { ok: true, values: r.values, outOfScopeSubIds: [] };
    }

    // Fetch every declared sub-template (id, schema, topicTagId). A
    // missing template still gets skipped silently — composition rows
    // are the source of truth, but stale ids shouldn't block work.
    const subs: Array<{
      id: string;
      schema: typeof template.formSchema;
      topicTagId: string | null;
    }> = [];
    for (const subId of subIds) {
      const sub = await this.templates.findById(subId);
      if (!sub) continue;
      subs.push({ id: sub.id, schema: sub.formSchema, topicTagId: sub.topicTagId });
    }

    // Resolve scope. Empty scope = no restriction; otherwise build a
    // single topic-id → slug map and partition.
    const scopeSet = new Set(actorTopicScope);
    let topicSlugById = new Map<string, string>();
    if (scopeSet.size > 0) {
      const allTopics = await this.topics.list();
      topicSlugById = new Map(allTopics.map((t) => [t.id, t.slug]));
    }
    const inScope = subs.filter((s) => {
      if (scopeSet.size === 0) return true;
      if (!s.topicTagId) return true;
      const slug = topicSlugById.get(s.topicTagId);
      return slug !== undefined && scopeSet.has(slug);
    });
    const inScopeIds = new Set(inScope.map((s) => s.id));
    const outOfScopeSubIds = subs.filter((s) => !inScopeIds.has(s.id)).map((s) => s.id);

    // Guard: incoming subs payload must only reference in-scope ids.
    const rawSubs = isObject(rawValues) ? (rawValues as { subs?: unknown }).subs : undefined;
    if (isObject(rawSubs)) {
      for (const key of Object.keys(rawSubs)) {
        if (!inScopeIds.has(key)) {
          return {
            ok: false,
            errors: [
              {
                fieldId: `subs.${key}`,
                code: "unknown_field",
                message: "Sub-modelo fora do âmbito do utilizador.",
              },
            ],
          };
        }
      }
    }

    const composed = validateComposedFormValues(
      {
        main: template.formSchema,
        subTemplates: inScope.map(({ id, schema }) => ({ id, schema })),
      },
      rawValues,
      { mode },
    );
    if (!composed.ok) return composed;
    return { ok: true, values: composed.values as RecordValues, outOfScopeSubIds };
  }
}

function isObject(v: unknown): v is { [k: string]: unknown } {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

// V8.2 — wraps @bgreen/scoring.computeScore + adapts the result to the
// repository's ScoreSnapshotInput shape. Returns a fully-null snapshot
// (rather than undefined) when the template has no scoring metadata so
// the column write is explicit — re-submission of a previously-scored
// record against a since-edited template that dropped scoring will null
// the columns rather than leaving stale data. Published templates are
// immutable in v1, so this path is mostly defensive.
function buildScoreSnapshot(
  template: RecordTemplate,
  values: RecordValues,
): ScoreSnapshotInput {
  const result = computeScore(template.formSchema, values);
  if (!result) {
    return { score: null, scorePercent: null, scoreTier: null, scoreBreakdown: null };
  }
  return {
    score: result.total,
    scorePercent: result.percent,
    scoreTier: result.tier,
    scoreBreakdown: result.breakdown,
  };
}

// Merges existing.values.subs[outOfScope] into the validated values so an
// out-of-scope sub-template's data survives an update by a topic-scoped
// actor that couldn't see it.
function mergePreservedSubs(
  validatedValues: RecordValues,
  existingValues: RecordValues,
  outOfScopeSubIds: string[],
): RecordValues {
  const existingSubs = isObject(existingValues.subs) ? existingValues.subs : {};
  const validatedSubs = isObject(validatedValues.subs) ? validatedValues.subs : {};
  const merged: { [k: string]: unknown } = { ...validatedSubs };
  for (const subId of outOfScopeSubIds) {
    if (existingSubs[subId] !== undefined) merged[subId] = existingSubs[subId];
  }
  return { ...validatedValues, subs: merged };
}
