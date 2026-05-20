import type { FormError } from "@bgreen/form-engine";
import { validateFormValues } from "@bgreen/form-engine";
import type { Record, RecordStatus, RecordValues } from "@bgreen/types";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";

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
    status: RecordStatus;
    values: RecordValues;
    submittedAt: Date | null;
    submittedByUserId: string | null;
  }): Promise<Record>;
  updateValues(input: {
    organizationId: string;
    recordId: string;
    status: RecordStatus;
    values: RecordValues;
    submittedAt: Date | null;
  }): Promise<Record | null>;
  recordReview(input: {
    organizationId: string;
    recordId: string;
    status: RecordStatus;
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
  ) {}

  async submit(input: CreateRecordInput): Promise<SubmitResult> {
    const template = await this.templates.findById(input.organizationId, input.templateId);
    if (!template) return { ok: false, code: "template_not_found" };
    if (!input.asDraft && template.status !== "published") {
      return { ok: false, code: "template_not_published" };
    }

    const mode = input.asDraft ? "draft" : "submit";
    const validated = validateFormValues(template.formSchema, input.rawValues, { mode });
    if (!validated.ok) {
      return { ok: false, code: "validation_failed", errors: validated.errors };
    }

    const status: RecordStatus = input.asDraft ? "draft" : "submitted";
    const record = await this.records.insert({
      organizationId: input.organizationId,
      templateId: input.templateId,
      status,
      values: validated.values,
      submittedAt: input.asDraft ? null : new Date(),
      submittedByUserId: input.submitterUserId,
    });
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

    const template = await this.templates.findById(input.organizationId, existing.templateId);
    if (!template) return { ok: false, code: "template_not_found" };
    if (input.action === "submit" && template.status !== "published") {
      return { ok: false, code: "template_not_published" };
    }

    const mode = input.action === "submit" ? "submit" : "draft";
    const validated = validateFormValues(template.formSchema, input.rawValues, { mode });
    if (!validated.ok) {
      return { ok: false, code: "validation_failed", errors: validated.errors };
    }

    const status: RecordStatus = input.action === "submit" ? "submitted" : "draft";
    const submittedAt =
      input.action === "submit"
        ? new Date()
        : existing.submittedAt
          ? new Date(existing.submittedAt)
          : null;
    const record = await this.records.updateValues({
      organizationId: input.organizationId,
      recordId: input.recordId,
      status,
      values: validated.values,
      submittedAt,
    });
    if (!record) return { ok: false, code: "record_not_found" };
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

    const nextStatus: RecordStatus =
      input.decision === "approve"
        ? "approved"
        : input.decision === "request_changes"
          ? "changes_requested"
          : "rejected";

    const record = await this.records.recordReview({
      organizationId: input.organizationId,
      recordId: input.recordId,
      status: nextStatus,
      reviewComment: trimmed === "" ? null : trimmed,
      reviewedAt: new Date(),
      reviewedByUserId: input.reviewerUserId,
    });
    if (!record) return { ok: false, code: "record_not_found" };
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
    const template = await this.templates.findById(organizationId, templateId);
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
}
