import type { WorkflowDefinitionId } from "@bgreen/types";
import type {
  FormSchema,
  RecordTemplate,
  RecordTemplateStatus,
} from "../domain/record-template.js";

// V5.4 reshape: templates are owned by central services, not by orgs.
// All inputs drop organizationId; queries are global. The
// createdByUserId still points at the human (now a CS user).
// Audit calls are dropped for now — V5.4d will wire them into the CS
// workspace audit feed (audit_log.organization_id is currently NOT NULL,
// which doesn't fit template events).

export interface CreateRecordTemplateInput {
  name: string;
  description: string | null;
  formSchema: FormSchema;
  createdByUserId: string;
  workflowDefinitionId?: WorkflowDefinitionId;
  topicTagId?: string | null;
  isSubTemplate?: boolean;
}

export interface UpdateRecordTemplateInput {
  name?: string;
  description?: string | null;
  formSchema?: FormSchema;
  topicTagId?: string | null;
  isSubTemplate?: boolean;
}

export interface RecordTemplateRepository {
  create(input: CreateRecordTemplateInput): Promise<RecordTemplate>;
  findById(id: string): Promise<RecordTemplate | null>;
  listAll(): Promise<RecordTemplate[]>;
  update(id: string, patch: UpdateRecordTemplateInput): Promise<RecordTemplate | null>;
  setStatus(id: string, status: RecordTemplateStatus): Promise<RecordTemplate | null>;
}

export class RecordTemplateService {
  constructor(private readonly repo: RecordTemplateRepository) {}

  create(input: CreateRecordTemplateInput): Promise<RecordTemplate> {
    return this.repo.create(input);
  }

  get(id: string): Promise<RecordTemplate | null> {
    return this.repo.findById(id);
  }

  list(): Promise<RecordTemplate[]> {
    return this.repo.listAll();
  }

  update(id: string, patch: UpdateRecordTemplateInput): Promise<RecordTemplate | null> {
    return this.repo.update(id, patch);
  }

  publish(id: string): Promise<RecordTemplate | null> {
    return this.repo.setStatus(id, "published");
  }

  archive(id: string): Promise<RecordTemplate | null> {
    return this.repo.setStatus(id, "archived");
  }
}
