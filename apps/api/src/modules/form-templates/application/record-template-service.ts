import type { RecordTemplateListOptions, WorkflowDefinitionId } from "@bgreen/types";
import type {
  FormSchema,
  RecordTemplate,
  RecordTemplateStatus,
} from "../domain/record-template.js";
import type { CompositionRepository } from "../infrastructure/composition-repository.js";

// V5.4 reshape: templates are owned by central services, not by orgs.
// V5.5 adds composedSubTemplateIds for sub-template embedding.

export interface CreateRecordTemplateInput {
  name: string;
  description: string | null;
  formSchema: FormSchema;
  createdByUserId: string;
  workflowDefinitionId?: WorkflowDefinitionId;
  topicTagId?: string | null;
  isSubTemplate?: boolean;
  composedSubTemplateIds?: string[];
}

export interface UpdateRecordTemplateInput {
  name?: string;
  description?: string | null;
  formSchema?: FormSchema;
  topicTagId?: string | null;
  isSubTemplate?: boolean;
  composedSubTemplateIds?: string[];
}

export interface RecordTemplateRepository {
  create(input: CreateRecordTemplateInput): Promise<RecordTemplate>;
  findById(id: string): Promise<RecordTemplate | null>;
  // Batched variant — one round-trip for an arbitrary set of ids.
  // Order of returned rows is not guaranteed to match `ids`.
  findByIds(ids: string[]): Promise<RecordTemplate[]>;
  listAll(
    options?: RecordTemplateListOptions,
  ): Promise<{ items: RecordTemplate[]; total: number }>;
  update(id: string, patch: UpdateRecordTemplateInput): Promise<RecordTemplate | null>;
  setStatus(id: string, status: RecordTemplateStatus): Promise<RecordTemplate | null>;
}

export type CreateRecordTemplateResult =
  | { ok: true; template: RecordTemplate }
  | { ok: false; code: "self_composition" | "sub_template_cannot_compose" };

export class RecordTemplateService {
  constructor(
    private readonly repo: RecordTemplateRepository,
    private readonly compositions: CompositionRepository,
  ) {}

  async create(input: CreateRecordTemplateInput): Promise<CreateRecordTemplateResult> {
    if (input.isSubTemplate && (input.composedSubTemplateIds?.length ?? 0) > 0) {
      return { ok: false, code: "sub_template_cannot_compose" };
    }
    const created = await this.repo.create(input);
    if (input.composedSubTemplateIds && input.composedSubTemplateIds.length > 0) {
      if (input.composedSubTemplateIds.includes(created.id)) {
        return { ok: false, code: "self_composition" };
      }
      await this.compositions.setForMain(created.id, input.composedSubTemplateIds);
      return {
        ok: true,
        template: { ...created, composedSubTemplateIds: input.composedSubTemplateIds },
      };
    }
    return { ok: true, template: created };
  }

  async get(id: string): Promise<RecordTemplate | null> {
    const tpl = await this.repo.findById(id);
    if (!tpl) return null;
    const composedSubTemplateIds = await this.compositions.listForMain(id);
    return { ...tpl, composedSubTemplateIds };
  }

  async list(
    options: RecordTemplateListOptions = {},
  ): Promise<{ items: RecordTemplate[]; total: number }> {
    const { items, total } = await this.repo.listAll(options);
    const ids = items.map((t) => t.id);
    const compositionMap = await this.compositions.listForMains(ids);
    return {
      items: items.map((t) => ({
        ...t,
        composedSubTemplateIds: compositionMap.get(t.id) ?? [],
      })),
      total,
    };
  }

  async update(
    id: string,
    patch: UpdateRecordTemplateInput,
  ): Promise<
    { ok: true; template: RecordTemplate } | { ok: false; code: "self_composition" } | null
  > {
    if (patch.composedSubTemplateIds?.includes(id)) {
      return { ok: false, code: "self_composition" };
    }
    const updated = await this.repo.update(id, patch);
    if (!updated) return null;
    if (patch.composedSubTemplateIds !== undefined) {
      await this.compositions.setForMain(id, patch.composedSubTemplateIds);
      return {
        ok: true,
        template: { ...updated, composedSubTemplateIds: patch.composedSubTemplateIds },
      };
    }
    const composedSubTemplateIds = await this.compositions.listForMain(id);
    return { ok: true, template: { ...updated, composedSubTemplateIds } };
  }

  async publish(id: string): Promise<RecordTemplate | null> {
    const updated = await this.repo.setStatus(id, "published");
    if (!updated) return null;
    const composedSubTemplateIds = await this.compositions.listForMain(id);
    return { ...updated, composedSubTemplateIds };
  }

  async archive(id: string): Promise<RecordTemplate | null> {
    const updated = await this.repo.setStatus(id, "archived");
    if (!updated) return null;
    const composedSubTemplateIds = await this.compositions.listForMain(id);
    return { ...updated, composedSubTemplateIds };
  }
}
