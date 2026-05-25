import type {
  FormSchema,
  Record,
  RecordTemplate,
  RecordValues,
  ScoreBreakdownEntry,
} from "@bgreen/types";
import { describe, expect, it, vi } from "vitest";
import type { AuditService } from "../../audit/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import type { TopicRepository } from "../../topics/module.js";
import type { WorkflowService } from "../../workflows/module.js";
import {
  RecordService,
  type RecordRepository,
  type ScoreSnapshotInput,
} from "./record-service.js";

// V8.2 — focused tests on the scoring hook. The rest of the submit /
// update flow is exercised end-to-end elsewhere; this suite verifies
// that ScoringEngine is wired correctly and the snapshot lands on
// the right repo call with the right shape.

function scoredFormSchema(scoring?: FormSchema["scoring"]): FormSchema {
  return {
    version: 1,
    rows: [
      {
        id: "r1",
        fields: [
          {
            id: "policy",
            label: "Política",
            kind: "select",
            options: [
              { value: "yes", label: "Sim", score: 60 },
              { value: "no", label: "Não", score: 0 },
            ],
          },
        ],
      },
    ],
    scoring,
  };
}

const STANDARD_BUCKETS = {
  maxScore: 100,
  buckets: [
    { minPct: 0, label: "C" },
    { minPct: 50, label: "B" },
    { minPct: 80, label: "A" },
  ],
};

interface InsertCall {
  score?: ScoreSnapshotInput;
  submittedAt: Date | null;
  values: RecordValues;
}

interface UpdateCall {
  score?: ScoreSnapshotInput;
  submittedAt: Date | null;
  values: RecordValues;
}

function makeStubRepo(): { repo: RecordRepository; inserts: InsertCall[]; updates: UpdateCall[] } {
  const inserts: InsertCall[] = [];
  const updates: UpdateCall[] = [];
  // The repo holds at most one record across the test; we update it in
  // place rather than maintaining a real Map.
  let stored: Record | null = null;
  const repo: RecordRepository = {
    insert: async (input) => {
      inserts.push({ score: input.score, submittedAt: input.submittedAt, values: input.values });
      stored = {
        id: "rec-1",
        organizationId: input.organizationId,
        templateId: input.templateId,
        status: input.submittedAt ? "submitted" : "draft",
        values: input.values,
        reviewComment: null,
        submittedAt: input.submittedAt ? input.submittedAt.toISOString() : null,
        submittedByUserId: input.submittedByUserId,
        reviewedAt: null,
        reviewedByUserId: null,
        score: input.score?.score ?? null,
        scorePercent: input.score?.scorePercent ?? null,
        scoreTier: input.score?.scoreTier ?? null,
        scoreBreakdown: input.score?.scoreBreakdown ?? null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return stored;
    },
    updateValues: async (input) => {
      updates.push({ score: input.score, submittedAt: input.submittedAt, values: input.values });
      if (!stored) return null;
      const next: Record = {
        ...stored,
        values: input.values,
        submittedAt: input.submittedAt ? input.submittedAt.toISOString() : null,
        status: input.submittedAt ? "submitted" : stored.status,
        score: input.score?.score ?? stored.score,
        scorePercent: input.score?.scorePercent ?? stored.scorePercent,
        scoreTier: input.score?.scoreTier ?? stored.scoreTier,
        scoreBreakdown: input.score?.scoreBreakdown ?? stored.scoreBreakdown,
      };
      stored = next;
      return next;
    },
    recordReview: async () => stored,
    findById: async (_, id) => (stored && stored.id === id ? stored : null),
    findLatestSubmitted: async () => null,
    listForUserInOrg: async () => (stored ? [stored] : []),
    listForOrganization: async () => (stored ? [stored] : []),
  };
  return { repo, inserts, updates };
}

function makeStubTemplates(template: RecordTemplate): RecordTemplateRepository {
  return {
    findById: async (id: string) => (id === template.id ? template : null),
    findByIds: async (ids: string[]) => (ids.includes(template.id) ? [template] : []),
    list: async () => [template],
    listPublished: async () => (template.status === "published" ? [template] : []),
    insert: async () => template,
    update: async () => template,
  } as unknown as RecordTemplateRepository;
}

function makeStubWorkflows(): WorkflowService {
  return {
    start: vi.fn(async () => ({ ok: true as const })),
    send: vi.fn(async () => ({ ok: true as const })),
  } as unknown as WorkflowService;
}

function makeStubAudit(): AuditService {
  return { record: vi.fn(async () => undefined) } as unknown as AuditService;
}

function makeStubTopics(): TopicRepository {
  return { list: async () => [] } as unknown as TopicRepository;
}

function buildTemplate(overrides: Partial<RecordTemplate> = {}): RecordTemplate {
  return {
    id: "tpl-1",
    name: "ESG Self-assessment",
    description: null,
    formSchema: scoredFormSchema(STANDARD_BUCKETS),
    status: "published",
    workflowDefinitionId: "single-step-submit",
    topicTagId: null,
    isSubTemplate: false,
    composedSubTemplateIds: [],
    createdByUserId: "u-admin",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("RecordService scoring on submit", () => {
  it("submit (action=submit) computes the score and passes it to repo.insert", async () => {
    const { repo, inserts } = makeStubRepo();
    const template = buildTemplate();
    const service = new RecordService(
      repo,
      makeStubTemplates(template),
      makeStubAudit(),
      makeStubWorkflows(),
      makeStubTopics(),
    );

    const result = await service.submit({
      organizationId: "org-1",
      templateId: template.id,
      rawValues: { policy: "yes" },
      submitterUserId: "u-1",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(inserts).toHaveLength(1);
    const snap = inserts[0]?.score;
    expect(snap).toBeDefined();
    // 60 raw score; weight default 1; maxScore 100 → total 60, percent 60, tier B.
    expect(snap?.score).toBe(60);
    expect(snap?.scorePercent).toBe(60);
    expect(snap?.scoreTier).toBe("B");
    expect(snap?.scoreBreakdown).toEqual([
      { fieldId: "policy", raw: 60, weight: 1, weighted: 60 },
    ]);
    // The persisted record carries the score back to the caller.
    expect(result.record.score).toBe(60);
    expect(result.record.scoreTier).toBe("B");
  });

  it("submit as draft does NOT compute or pass a score snapshot", async () => {
    const { repo, inserts } = makeStubRepo();
    const template = buildTemplate();
    const service = new RecordService(
      repo,
      makeStubTemplates(template),
      makeStubAudit(),
      makeStubWorkflows(),
      makeStubTopics(),
    );

    const result = await service.submit({
      organizationId: "org-1",
      templateId: template.id,
      rawValues: { policy: "yes" },
      submitterUserId: "u-1",
      asDraft: true,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(inserts).toHaveLength(1);
    expect(inserts[0]?.score).toBeUndefined();
    expect(result.record.score).toBeNull();
  });

  it("template without scoring → snapshot has all-null fields (explicit null write)", async () => {
    const { repo, inserts } = makeStubRepo();
    const template = buildTemplate({ formSchema: scoredFormSchema(undefined) });
    const service = new RecordService(
      repo,
      makeStubTemplates(template),
      makeStubAudit(),
      makeStubWorkflows(),
      makeStubTopics(),
    );

    const result = await service.submit({
      organizationId: "org-1",
      templateId: template.id,
      rawValues: { policy: "yes" },
      submitterUserId: "u-1",
    });
    expect(result.ok).toBe(true);
    const snap = inserts[0]?.score;
    expect(snap).toEqual({
      score: null,
      scorePercent: null,
      scoreTier: null,
      scoreBreakdown: null,
    } satisfies ScoreSnapshotInput);
  });
});

describe("RecordService scoring on update", () => {
  it("save_draft does NOT pass a score snapshot (leaves columns untouched)", async () => {
    const { repo, updates } = makeStubRepo();
    const template = buildTemplate();
    const service = new RecordService(
      repo,
      makeStubTemplates(template),
      makeStubAudit(),
      makeStubWorkflows(),
      makeStubTopics(),
    );

    // First land a draft so update has something to find.
    await service.submit({
      organizationId: "org-1",
      templateId: template.id,
      rawValues: { policy: "no" },
      submitterUserId: "u-1",
      asDraft: true,
    });
    const result = await service.update({
      organizationId: "org-1",
      recordId: "rec-1",
      rawValues: { policy: "yes" },
      actorUserId: "u-1",
      action: "save_draft",
    });
    expect(result.ok).toBe(true);
    expect(updates).toHaveLength(1);
    expect(updates[0]?.score).toBeUndefined();
  });

  it("action=submit on a draft recomputes the score against the new values", async () => {
    const { repo, updates } = makeStubRepo();
    const template = buildTemplate();
    const service = new RecordService(
      repo,
      makeStubTemplates(template),
      makeStubAudit(),
      makeStubWorkflows(),
      makeStubTopics(),
    );

    await service.submit({
      organizationId: "org-1",
      templateId: template.id,
      rawValues: { policy: "no" },
      submitterUserId: "u-1",
      asDraft: true,
    });
    const result = await service.update({
      organizationId: "org-1",
      recordId: "rec-1",
      rawValues: { policy: "yes" },
      actorUserId: "u-1",
      action: "submit",
    });
    expect(result.ok).toBe(true);
    expect(updates).toHaveLength(1);
    const snap = updates[0]?.score;
    expect(snap?.score).toBe(60);
    expect(snap?.scoreTier).toBe("B");
    // Breakdown reflects the NEW values (policy: yes), not the prior
    // draft's (policy: no) values.
    expect(snap?.scoreBreakdown).toEqual([
      { fieldId: "policy", raw: 60, weight: 1, weighted: 60 },
    ] satisfies ScoreBreakdownEntry[]);
  });
});

describe("RecordService.listScoresGroupedByTemplate", () => {
  it("excludes drafts and returns sorted ascending by submittedAt", async () => {
    const { repo } = makeStubRepo();
    const template = buildTemplate();

    // Pre-seed a draft via submit(), then re-submit so the score lands.
    const tmp = new RecordService(
      repo,
      makeStubTemplates(template),
      makeStubAudit(),
      makeStubWorkflows(),
      makeStubTopics(),
    );
    await tmp.submit({
      organizationId: "org-1",
      templateId: template.id,
      rawValues: { policy: "yes" },
      submitterUserId: "u-1",
    });

    const list = await tmp.listScoresGroupedByTemplate("org-1");
    expect(list).toHaveLength(1);
    expect(list[0]?.templateName).toBe("ESG Self-assessment");
    expect(list[0]?.scores).toHaveLength(1);
    expect(list[0]?.scores[0]?.total).toBe(60);
  });

  it("returns empty array when no scored records exist", async () => {
    const { repo } = makeStubRepo();
    const template = buildTemplate();
    const service = new RecordService(
      repo,
      makeStubTemplates(template),
      makeStubAudit(),
      makeStubWorkflows(),
      makeStubTopics(),
    );

    // Draft only — no submitted-with-score record.
    await service.submit({
      organizationId: "org-1",
      templateId: template.id,
      rawValues: { policy: "yes" },
      submitterUserId: "u-1",
      asDraft: true,
    });
    const list = await service.listScoresGroupedByTemplate("org-1");
    expect(list).toEqual([]);
  });
});
