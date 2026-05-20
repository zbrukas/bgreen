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
  constructor(private readonly repo: RecordTemplateRepository) {}

  create(input: CreateRecordTemplateInput): Promise<RecordTemplate> {
    return this.repo.create(input);
  }

  get(organizationId: string, id: string): Promise<RecordTemplate | null> {
    return this.repo.findById(organizationId, id);
  }

  list(organizationId: string): Promise<RecordTemplate[]> {
    return this.repo.listForOrganization(organizationId);
  }

  update(
    organizationId: string,
    id: string,
    patch: UpdateRecordTemplateInput,
  ): Promise<RecordTemplate | null> {
    return this.repo.update(organizationId, id, patch);
  }

  publish(organizationId: string, id: string): Promise<RecordTemplate | null> {
    return this.repo.setStatus(organizationId, id, "published");
  }

  archive(organizationId: string, id: string): Promise<RecordTemplate | null> {
    return this.repo.setStatus(organizationId, id, "archived");
  }
}
