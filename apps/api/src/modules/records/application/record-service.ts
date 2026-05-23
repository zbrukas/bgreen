import type { FormError, ValidationMode } from "@bgreen/form-engine";
import { validateComposedFormValues, validateFormValues } from "@bgreen/form-engine";
import type { Record, RecordTemplate, RecordValues } from "@bgreen/types";
import type { AuditService } from "../../audit/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import type { WorkflowService } from "../../workflows/module.js";
import { defaultWorkflowDefinitionId } from "../../workflows/module.js";

export interface CreateRecordInput {
  organizationId: string;
  templateId: string;
  rawValues: unknown;
  submitterUserId: string;
  asDraft?: boolean;
}

export interface UpdateRecordInput {
  organizationId: string;
  recordId: string;
  rawValues: unknown;
  actorUserId: string;
  // "save_draft" leaves the record in draft state; "submit" promotes it.
  action: "save_draft" | "submit";
}

export interface RecordRepository {
  insert(input: {
    organizationId: string;
    templateId: string;
    values: RecordValues;
    submittedAt: Date | null;
    submittedByUserId: string | null;
  }): Promise<Record>;
  updateValues(input: {
    organizationId: string;
    recordId: string;
    values: RecordValues;
    submittedAt: Date | null;
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
  listForUserInOrg(organizationId: string, userId: string): Promise<Record[]>;
  listForOrganization(organizationId: string): Promise<Record[]>;
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

export class RecordService {
  constructor(
    private readonly records: RecordRepository,
    private readonly templates: RecordTemplateRepository,
    private readonly audit: AuditService,
    private readonly workflows: WorkflowService,
  ) {}

  async submit(input: CreateRecordInput): Promise<SubmitResult> {
    const template = await this.templates.findById(input.templateId);
    if (!template) return { ok: false, code: "template_not_found" };
    if (!input.asDraft && template.status !== "published") {
      return { ok: false, code: "template_not_published" };
    }

    const mode: ValidationMode = input.asDraft ? "draft" : "submit";
    const validated = await this.validateAgainstTemplate(template, input.rawValues, mode);
    if (!validated.ok) {
      return { ok: false, code: "validation_failed", errors: validated.errors };
    }

    // Insert the record row. Workflow instance is created right after;
    // status lives on the workflow_instance, not the record row.
    const record = await this.records.insert({
      organizationId: input.organizationId,
      templateId: input.templateId,
      values: validated.values,
      submittedAt: input.asDraft ? null : new Date(),
      submittedByUserId: input.submitterUserId,
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
    const validated = await this.validateAgainstTemplate(template, input.rawValues, mode);
    if (!validated.ok) {
      return { ok: false, code: "validation_failed", errors: validated.errors };
    }

    const submittedAt =
      input.action === "submit"
        ? new Date()
        : existing.submittedAt
          ? new Date(existing.submittedAt)
          : null;
    const record = await this.records.updateValues({
      organizationId: input.organizationId,
      recordId: input.recordId,
      values: validated.values,
      submittedAt,
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

  listMine(organizationId: string, userId: string): Promise<Record[]> {
    return this.records.listForUserInOrg(organizationId, userId);
  }

  listAll(organizationId: string): Promise<Record[]> {
    return this.records.listForOrganization(organizationId);
  }

  // Picks the plain or composed validator based on whether the template
  // declares any sub-templates. Sub-template schemas are fetched lazily;
  // a missing one is skipped silently — the composition row is the
  // source of truth, and a stale id won't block a submission.
  private async validateAgainstTemplate(
    template: RecordTemplate,
    rawValues: unknown,
    mode: ValidationMode,
  ): Promise<{ ok: true; values: RecordValues } | { ok: false; errors: FormError[] }> {
    const subIds = template.composedSubTemplateIds;
    if (!subIds || subIds.length === 0) {
      return validateFormValues(template.formSchema, rawValues, { mode });
    }
    const subs: Array<{ id: string; schema: typeof template.formSchema }> = [];
    for (const subId of subIds) {
      const sub = await this.templates.findById(subId);
      if (!sub) continue;
      subs.push({ id: sub.id, schema: sub.formSchema });
    }
    const composed = validateComposedFormValues(
      { main: template.formSchema, subTemplates: subs },
      rawValues,
      { mode },
    );
    if (!composed.ok) return composed;
    // Cast: ComposedRecordValues is RecordValues + { subs?: ... } which
    // is structurally a RecordValues for the storage layer.
    return { ok: true, values: composed.values as RecordValues };
  }
}
