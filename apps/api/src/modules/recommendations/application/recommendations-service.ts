// RecommendationsService — the V9 orchestration. Two entry points:
//
//   start({orgId, userId}) → inserts a pending row, fires an Inngest
//   event, returns the row id. The route returns immediately so the
//   UI can poll. Generation runs in the background.
//
//   runGeneration(genId, inngestRunId) → called by the Inngest function.
//   Gathers the profile, calls the AI tool, persists the result, writes
//   the `recommendations.generate` audit row with profile-completeness
//   mode + token cost.
//
// Result transparency: any AI failure marks the row failed with the
// pt-PT error message; the UI surfaces this verbatim on the next poll.

import type { AiClient } from "@bgreen/ai";
import type { AuditService } from "../../audit/module.js";
import type { OrganizationRepository } from "../../organizations/module.js";
import type { EconomicProfileRepository } from "../../economic-profile/module.js";
import type { RecordTemplateRepository } from "../../form-templates/application/record-template-service.js";
import type { RecordRepository } from "../../records/application/record-service.js";
import type { SectorBenchmarkLookup } from "../../sector-benchmark/module.js";
import type {
  FeedbackCounts,
  GeneratedRecommendation,
  Recommendation,
  RecommendationFeedback,
  RecommendationFeedbackKind,
} from "../domain/types.js";
import type { GeneratedRecommendationRepository } from "../infrastructure/generated-recommendation-repository.js";
import type { RecommendationFeedbackRepository } from "../infrastructure/recommendation-feedback-repository.js";
import { classifyCompleteness } from "./completeness.js";
import { ProfileGatherer } from "./profile-gatherer.js";
import { generateRecommendationsTool } from "./tools/generate-recommendations-tool.js";

// Same pt-PT vocabulary pattern used by IesExtractionService: one place
// for the failure messages the user actually sees.
const ERR_AI_TRANSIENT =
  "O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.";
const ERR_AI_PARSE =
  "Não foi possível gerar recomendações neste momento. Tente novamente em breve.";
const ERR_MODE_MISMATCH =
  "Resposta inesperada do modelo. Tente novamente em breve.";

// Inngest event the service emits when a new generation starts. The
// Inngest function listens for this and calls back into
// runGeneration(genId) on the same service instance.
export interface RecommendationsEventSender {
  send(event: {
    name: "recommendations.generation.started";
    data: { generatedRecommendationId: string };
  }): Promise<void>;
}

export type StartRecommendationsError =
  | { kind: "queue_failed"; reason: string };

export type StartRecommendationsResult =
  | { ok: true; generated: GeneratedRecommendation }
  | { ok: false; error: StartRecommendationsError };

export type FeedbackError = "generation_not_found" | "out_of_range" | "not_ready";

export type FeedbackResult =
  | { ok: true; feedback: RecommendationFeedback }
  | { ok: false; error: FeedbackError };

export interface RecommendationHistoryEntry {
  generation: GeneratedRecommendation;
  feedbackCounts: FeedbackCounts;
}

export interface RunGenerationOutcome {
  generationId: string;
  status: GeneratedRecommendation["status"];
  errorMessage?: string;
}

export class RecommendationsService {
  private readonly gatherer: ProfileGatherer;

  constructor(
    private readonly repo: GeneratedRecommendationRepository,
    private readonly feedback: RecommendationFeedbackRepository,
    private readonly ai: AiClient,
    private readonly audit: AuditService,
    private readonly events: RecommendationsEventSender,
    deps: {
      orgs: OrganizationRepository;
      profiles: EconomicProfileRepository;
      sector: SectorBenchmarkLookup;
      records: RecordRepository;
      templates: RecordTemplateRepository;
    },
  ) {
    this.gatherer = new ProfileGatherer(
      deps.orgs,
      deps.profiles,
      deps.sector,
      deps.records,
      deps.templates,
    );
  }

  // Boundary entry. Classifies completeness, persists the row in
  // `pending`, fires the Inngest event, returns the row so the route
  // can hand the id back to the UI.
  async start(input: {
    organizationId: string;
    userId: string;
  }): Promise<StartRecommendationsResult> {
    const snapshot = await this.gatherer.gather(input.organizationId);
    const mode = classifyCompleteness(snapshot.signals);

    const generated = await this.repo.insert({
      organizationId: input.organizationId,
      requestedByUserId: input.userId,
      completenessMode: mode,
    });

    try {
      await this.events.send({
        name: "recommendations.generation.started",
        data: { generatedRecommendationId: generated.id },
      });
    } catch (e) {
      await this.repo.update(generated.id, {
        status: "failed",
        errorMessage: "Falha ao iniciar a geração. Tente novamente.",
        completedAt: new Date(),
      });
      return {
        ok: false,
        error: {
          kind: "queue_failed",
          reason: e instanceof Error ? e.message : String(e),
        },
      };
    }

    const persisted = await this.repo.findAnyById(generated.id);
    return { ok: true, generated: persisted ?? generated };
  }

  // Inngest entry. Re-gathers the profile (the start() snapshot isn't
  // persisted — the AI call is the only externalised step that consumes
  // it, and we want the freshest data when the function actually runs).
  async runGeneration(
    generationId: string,
    inngestRunId?: string,
  ): Promise<RunGenerationOutcome> {
    const generation = await this.repo.findAnyById(generationId);
    if (!generation) {
      return { generationId, status: "failed", errorMessage: "internal: not found" };
    }
    // Idempotency guard: a retry should not re-run a terminal row.
    if (generation.status !== "pending" && generation.status !== "running") {
      return { generationId, status: generation.status };
    }

    await this.repo.update(generationId, {
      status: "running",
      startedAt: new Date(),
      inngestRunId: inngestRunId ?? null,
    });

    const snapshot = await this.gatherer.gather(generation.organizationId);
    // Re-classify on the running snapshot. If the user uploaded an IES
    // between start() and the Inngest pickup, they get the better mode.
    const mode = classifyCompleteness(snapshot.signals);

    const aiResult = await this.ai.call(
      generateRecommendationsTool,
      { completenessMode: mode, profile: snapshot.toolInput },
      {
        organizationId: generation.organizationId,
        actorUserId: generation.requestedByUserId,
        correlationId: generation.id,
        metadata: {
          feature: "recommendations",
          entityKind: "generated_recommendation",
          completenessMode: mode,
        },
      },
    );

    if (!aiResult.ok) {
      const message =
        aiResult.error.kind === "transient" ? ERR_AI_TRANSIENT : ERR_AI_PARSE;
      return this.fail(generation.id, message);
    }

    // The model occasionally drifts and echoes a different mode than we
    // requested. Treat that as a parse-class failure rather than silently
    // accepting — the prompt-mode guarantee is part of the contract.
    if (aiResult.value.completenessMode !== mode) {
      return this.fail(generation.id, ERR_MODE_MISMATCH);
    }

    const recommendations: Recommendation[] = aiResult.value.recommendations.map((r) => ({
      title: r.title,
      description: r.description,
      estimatedImpact: r.estimatedImpact,
      implementationEffort: r.implementationEffort,
      timeHorizon: r.timeHorizon,
      rationale: r.rationale,
    }));

    const final = await this.repo.update(generation.id, {
      status: "ready",
      recommendations,
      completedAt: new Date(),
      // Token usage lives on the audit row written by the AI observer;
      // surfacing it here too lets the history view show cost without a
      // join. Both observers + the row see the same numbers.
    });

    // Authoritative audit row — separate from the per-AI-call
    // `ai.tool_call.*` row written by the observer. Captures
    // completeness mode + (best-effort) recommendation count so the
    // history view can render counts without parsing the JSONB.
    await this.audit.record({
      actorUserId: generation.requestedByUserId,
      organizationId: generation.organizationId,
      entityKind: "generated_recommendation",
      entityId: generation.id,
      action: "recommendations.generate",
      payload: {
        completenessMode: mode,
        recommendationCount: recommendations.length,
      },
      correlationId: generation.id,
    });

    return { generationId: generation.id, status: final?.status ?? "ready" };
  }

  // Tenant-checked read for the polling UI.
  getStatus(organizationId: string, id: string): Promise<GeneratedRecommendation | null> {
    return this.repo.findById(organizationId, id);
  }

  // History view. One row per generation run; counts come from a
  // per-row aggregation. The `useful` count is the most-clicked metric;
  // we return the full kind→count map so the UI can show whatever it
  // wants without a second roundtrip.
  async listHistory(organizationId: string): Promise<RecommendationHistoryEntry[]> {
    const generations = await this.repo.listForOrganization(organizationId);
    const out: RecommendationHistoryEntry[] = [];
    for (const g of generations) {
      const feedbackCounts = await this.feedback.countsByGeneration(g.id);
      out.push({ generation: g, feedbackCounts });
    }
    return out;
  }

  // Records one user's feedback on one item. Idempotent — switching the
  // chip updates the existing row. The unique index in migration 0018
  // backs the ON CONFLICT path.
  async recordFeedback(input: {
    organizationId: string;
    userId: string;
    generationId: string;
    recommendationIndex: number;
    kind: RecommendationFeedbackKind;
  }): Promise<FeedbackResult> {
    const generation = await this.repo.findById(input.organizationId, input.generationId);
    if (!generation) return { ok: false, error: "generation_not_found" };
    if (generation.status !== "ready" || !generation.recommendations) {
      return { ok: false, error: "not_ready" };
    }
    if (
      input.recommendationIndex < 0 ||
      input.recommendationIndex >= generation.recommendations.length
    ) {
      return { ok: false, error: "out_of_range" };
    }
    const feedback = await this.feedback.upsert({
      generatedRecommendationId: generation.id,
      recommendationIndex: input.recommendationIndex,
      userId: input.userId,
      kind: input.kind,
    });

    // Audit each feedback write — payload is small and the rows
    // accumulate signal for the V1.5 curated library seeding.
    await this.audit.record({
      actorUserId: input.userId,
      organizationId: input.organizationId,
      entityKind: "generated_recommendation",
      entityId: generation.id,
      action: "recommendations.feedback",
      payload: {
        recommendationIndex: input.recommendationIndex,
        kind: input.kind,
      },
      correlationId: generation.id,
    });

    return { ok: true, feedback };
  }

  private async fail(generationId: string, message: string): Promise<RunGenerationOutcome> {
    await this.repo.update(generationId, {
      status: "failed",
      errorMessage: message,
      completedAt: new Date(),
    });
    return { generationId, status: "failed", errorMessage: message };
  }
}
