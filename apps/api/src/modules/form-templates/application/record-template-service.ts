import type { AuditService } from "../../audit/module.js";
import type {
  FormSchema,
  RecordTemplate,
  RecordTemplateStatus,
} from "../domain/record-template.js";

export interface CreateRecordTemplateInput {
  organizationId: string;
  name: string;
  description: string | null;
  formSchema: FormSchema;
  createdByUserId: string;
}

export interface UpdateRecordTemplateInput {
  name?: string;
  description?: string | null;
  formSchema?: FormSchema;
}

export interface RecordTemplateRepository {
  create(input: CreateRecordTemplateInput): Promise<RecordTemplate>;
  findById(organizationId: string, id: string): Promise<RecordTemplate | null>;
  listForOrganization(organizationId: string): Promise<RecordTemplate[]>;
  update(
    organizationId: string,
    id: string,
    patch: UpdateRecordTemplateInput,
  ): Promise<RecordTemplate | null>;
  setStatus(
    organizationId: string,
    id: string,
    status: RecordTemplateStatus,
  ): Promise<RecordTemplate | null>;
}

export class RecordTemplateService {
  constructor(
    private readonly repo: RecordTemplateRepository,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateRecordTemplateInput): Promise<RecordTemplate> {
    const template = await this.repo.create(input);
    await this.audit.record({
      actorUserId: input.createdByUserId,
      organizationId: input.organizationId,
      entityKind: "record_template",
      entityId: template.id,
      action: "template.created",
      payload: { name: template.name, status: template.status },
    });
    return template;
  }

  get(organizationId: string, id: string): Promise<RecordTemplate | null> {
    return this.repo.findById(organizationId, id);
  }

  list(organizationId: string): Promise<RecordTemplate[]> {
    return this.repo.listForOrganization(organizationId);
  }

  async update(
    organizationId: string,
    id: string,
    patch: UpdateRecordTemplateInput,
    actorUserId: string,
  ): Promise<RecordTemplate | null> {
    const updated = await this.repo.update(organizationId, id, patch);
    if (updated) {
      await this.audit.record({
        actorUserId,
        organizationId,
        entityKind: "record_template",
        entityId: id,
        action: "template.updated",
        payload: { changedFields: Object.keys(patch) },
      });
    }
    return updated;
  }

  async publish(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<RecordTemplate | null> {
    const updated = await this.repo.setStatus(organizationId, id, "published");
    if (updated) {
      await this.audit.record({
        actorUserId,
        organizationId,
        entityKind: "record_template",
        entityId: id,
        action: "template.published",
        payload: {},
      });
    }
    return updated;
  }

  async archive(
    organizationId: string,
    id: string,
    actorUserId: string,
  ): Promise<RecordTemplate | null> {
    const updated = await this.repo.setStatus(organizationId, id, "archived");
    if (updated) {
      await this.audit.record({
        actorUserId,
        organizationId,
        entityKind: "record_template",
        entityId: id,
        action: "template.archived",
        payload: {},
      });
    }
    return updated;
  }
}
