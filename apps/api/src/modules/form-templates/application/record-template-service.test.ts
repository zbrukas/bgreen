import type { RecordTemplate } from "@bgreen/types";
import { describe, expect, it, vi } from "vitest";
import type { CompositionRepository } from "../infrastructure/composition-repository.js";
import {
  type CreateRecordTemplateInput,
  type RecordTemplateRepository,
  RecordTemplateService,
} from "./record-template-service.js";

const now = "2026-01-01T00:00:00.000Z";

const baseInput: CreateRecordTemplateInput = {
  name: "Energia mensal",
  description: null,
  createdByUserId: "u-admin",
  workflowDefinitionId: "two-step-review",
  formSchema: {
    version: 1,
    rows: [
      {
        id: "r1",
        fields: [{ id: "kwh", label: "kWh", kind: "number", unit: "kWh" }],
      },
    ],
  },
};

function makeTemplate(overrides: Partial<RecordTemplate> = {}): RecordTemplate {
  return {
    id: "tpl-main",
    name: "Energia mensal",
    description: null,
    formSchema: baseInput.formSchema,
    status: "draft",
    workflowDefinitionId: "two-step-review",
    topicTagId: null,
    isSubTemplate: false,
    composedSubTemplateIds: [],
    createdByUserId: "u-admin",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function setup(initial: RecordTemplate[] = [makeTemplate()]) {
  const templates = new Map(initial.map((t) => [t.id, t]));
  const compositions = new Map<string, string[]>();
  const repo: RecordTemplateRepository = {
    create: vi.fn(async (input) => {
      const template = makeTemplate({
        id: input.name === "Self" ? "tpl-self" : "tpl-main",
        name: input.name,
        description: input.description,
        formSchema: input.formSchema,
        workflowDefinitionId: input.workflowDefinitionId ?? "two-step-review",
        topicTagId: input.topicTagId ?? null,
        isSubTemplate: input.isSubTemplate ?? false,
        createdByUserId: input.createdByUserId,
      });
      templates.set(template.id, template);
      return template;
    }),
    findById: vi.fn(async (id) => templates.get(id) ?? null),
    findByIds: vi.fn(
      async (ids: string[]) =>
        ids.map((id: string) => templates.get(id)).filter(Boolean) as RecordTemplate[],
    ),
    listAll: vi.fn(async () => ({ items: [...templates.values()], total: templates.size })),
    update: vi.fn(async (id, patch) => {
      const existing = templates.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...patch };
      templates.set(id, updated);
      return updated;
    }),
    setStatus: vi.fn(async (id, status) => {
      const existing = templates.get(id);
      if (!existing) return null;
      const updated = { ...existing, status };
      templates.set(id, updated);
      return updated;
    }),
  };
  const compositionRepo: CompositionRepository = {
    listForMain: vi.fn(async (mainId) => compositions.get(mainId) ?? []),
    listForMains: vi.fn(
      async (mainIds: string[]) =>
        new Map<string, string[]>(mainIds.map((id: string) => [id, compositions.get(id) ?? []])),
    ),
    setForMain: vi.fn(async (mainId, subIds) => {
      compositions.set(mainId, subIds);
    }),
  };
  const service = new RecordTemplateService(repo, compositionRepo);
  return { service, repo, compositions: compositionRepo };
}

describe("RecordTemplateService", () => {
  it("rejects sub-template creation when it tries to compose other sub-templates", async () => {
    const { service, repo, compositions } = setup();

    const result = await service.create({
      ...baseInput,
      isSubTemplate: true,
      composedSubTemplateIds: ["tpl-sub"],
    });

    expect(result).toEqual({ ok: false, code: "sub_template_cannot_compose" });
    expect(repo.create).not.toHaveBeenCalled();
    expect(compositions.setForMain).not.toHaveBeenCalled();
  });

  it("stores composition order on create and returns it with the template", async () => {
    const { service, compositions } = setup();

    const result = await service.create({
      ...baseInput,
      composedSubTemplateIds: ["tpl-sub-a", "tpl-sub-b"],
    });

    expect(result).toMatchObject({
      ok: true,
      template: { id: "tpl-main", composedSubTemplateIds: ["tpl-sub-a", "tpl-sub-b"] },
    });
    expect(compositions.setForMain).toHaveBeenCalledWith("tpl-main", ["tpl-sub-a", "tpl-sub-b"]);
  });

  it("hydrates composition ids for list and publish results", async () => {
    const { service, compositions } = setup([
      makeTemplate({ id: "tpl-a", name: "A" }),
      makeTemplate({ id: "tpl-b", name: "B" }),
    ]);
    vi.mocked(compositions.listForMains).mockResolvedValueOnce(
      new Map([
        ["tpl-a", ["sub-a"]],
        ["tpl-b", ["sub-b-1", "sub-b-2"]],
      ]),
    );
    vi.mocked(compositions.listForMain).mockResolvedValueOnce(["sub-a"]);

    const listed = await service.list();
    const published = await service.publish("tpl-a");

    expect(listed.items).toEqual([
      expect.objectContaining({ id: "tpl-a", composedSubTemplateIds: ["sub-a"] }),
      expect.objectContaining({ id: "tpl-b", composedSubTemplateIds: ["sub-b-1", "sub-b-2"] }),
    ]);
    expect(published).toEqual(
      expect.objectContaining({ status: "published", composedSubTemplateIds: ["sub-a"] }),
    );
  });

  it("rejects self-composition on update before writing the patch", async () => {
    const { service, repo, compositions } = setup();

    const result = await service.update("tpl-main", { composedSubTemplateIds: ["tpl-main"] });

    expect(result).toEqual({ ok: false, code: "self_composition" });
    expect(repo.update).not.toHaveBeenCalled();
    expect(compositions.setForMain).not.toHaveBeenCalled();
  });
});
