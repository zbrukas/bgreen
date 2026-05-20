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

export interface RecordRepository {
  insert(input: {
    organizationId: string;
    templateId: string;
    status: RecordStatus;
    values: RecordValues;
    submittedAt: Date | null;
    submittedByUserId: string | null;
  }): Promise<Record>;
  findById(organizationId: string, id: string): Promise<Record | null>;
  listForUserInOrg(organizationId: string, userId: string): Promise<Record[]>;
  listForOrganization(organizationId: string): Promise<Record[]>;
}

export type SubmitResult =
  | { ok: true; record: Record }
  | { ok: false; code: "template_not_found" | "template_not_published" }
  | { ok: false; code: "validation_failed"; errors: FormError[] };

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

    const validated = validateFormValues(template.formSchema, input.rawValues);
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
