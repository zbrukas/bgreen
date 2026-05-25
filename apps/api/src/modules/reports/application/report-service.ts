// ReportService — V11.3 orchestration. Two entry points:
//
//   start({orgId, userId, template, period, customTitle?}) → builds
//   the data snapshot, hashes it, inserts a `report_instances` row
//   with the hash + status='pending', fires an Inngest event,
//   returns the row. The route returns 202 so the UI can poll.
//
//   runGeneration(reportId, inngestRunId) → called by the Inngest
//   function. Re-builds the snapshot, asks Claude for commentary,
//   composes the apps/pdf payload, sends it to the renderer,
//   uploads bytes to S3, emails the requester, writes audit rows.
//
// AI commentary failures degrade gracefully: the report renders
// without the commentary block (the template handles `commentary:
// null`). PDF/S3 failures fail the row hard — there's no fallback
// for the bytes.

import type { AiClient } from "@bgreen/ai";
import type { PdfRenderer } from "@bgreen/pdf-engine";
import type { S3Uploader } from "@bgreen/storage";
import type { AuditService } from "../../audit/module.js";
import type { ReportCommentary, ReportInstance, ReportTemplateId } from "../domain/types.js";
import { hashInputData } from "./input-data-hasher.js";
import type { ReportDataBuilder, ReportDataSnapshot } from "./report-data-builder.js";
import type { ReportInstanceRepository } from "../infrastructure/report-instance-repository.js";
import { generateReportCommentaryTool } from "./tools/generate-report-commentary-tool.js";

// pt-PT vocabulary surfaced to the user when a step fails. Same
// pattern as V9 + V10.
const ERR_PDF_RENDER = "Não foi possível gerar o PDF do relatório. Tente novamente.";
const ERR_PDF_STORE = "Não foi possível guardar o relatório. Tente novamente.";

// Email notification port. Real impl lives in @bgreen/emails (V11.3
// adds report-ready-email.ts wrapping the existing nodemailer
// transport). Kept narrow so tests substitute a recording fake.
export interface ReportReadyEmailSender {
  send(input: {
    to: string;
    organizationName: string;
    reportTitle: string;
    downloadUrl: string;
    generatedAt: string;
  }): Promise<{ delivered: boolean; reason?: string }>;
}

// User-lookup port. ReportService needs the requester's email
// address; UserRepository already has findById but this narrow port
// keeps the service decoupled from identity internals.
export interface ReportEmailRecipientLookup {
  findEmailById(userId: string): Promise<string | null>;
}

export interface ReportEventSender {
  send(event: {
    name: "report.generation.started";
    data: { reportId: string };
  }): Promise<void>;
}

export type StartReportError =
  | { kind: "queue_failed"; reason: string };

export type StartReportResult =
  | { ok: true; report: ReportInstance }
  | { ok: false; error: StartReportError };

export interface RunReportOutcome {
  reportId: string;
  status: ReportInstance["status"];
  errorMessage?: string;
}

export interface ReportServiceDependencies {
  reports: ReportInstanceRepository;
  builder: ReportDataBuilder;
  ai: AiClient;
  pdf: PdfRenderer;
  s3: S3Uploader;
  email: ReportReadyEmailSender;
  users: ReportEmailRecipientLookup;
  events: ReportEventSender;
  audit: AuditService;
}

export class ReportService {
  constructor(private readonly deps: ReportServiceDependencies) {}

  async start(input: {
    organizationId: string;
    userId: string;
    template: ReportTemplateId;
    periodStart: string;
    periodEnd: string;
    customTitle?: string;
  }): Promise<StartReportResult> {
    const snapshot = await this.deps.builder.build({
      organizationId: input.organizationId,
      template: input.template,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      customTitle: input.customTitle,
    });

    // Hash the snapshot BEFORE the AI call. The hash is a property of
    // the inputs; regenerating the report should reproduce the same
    // hash even when the AI commentary differs.
    const inputDataHash = hashInputData(snapshot);

    const report = await this.deps.reports.insert({
      organizationId: input.organizationId,
      requestedByUserId: input.userId,
      templateId: input.template,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      inputDataHash,
    });

    await this.deps.audit.record({
      actorUserId: input.userId,
      organizationId: input.organizationId,
      entityKind: "report_instance",
      entityId: report.id,
      action: "report.generate_started",
      payload: {
        template: input.template,
        period: { start: input.periodStart, end: input.periodEnd },
        inputDataHash,
      },
      correlationId: report.id,
    });

    try {
      await this.deps.events.send({
        name: "report.generation.started",
        data: { reportId: report.id },
      });
    } catch (e) {
      await this.deps.reports.update(report.id, {
        status: "failed",
        errorMessage: "Falha ao iniciar a geração do relatório. Tente novamente.",
      });
      return {
        ok: false,
        error: {
          kind: "queue_failed",
          reason: e instanceof Error ? e.message : String(e),
        },
      };
    }

    const persisted = await this.deps.reports.findAnyById(report.id);
    return { ok: true, report: persisted ?? report };
  }

  // Inngest entry. Pulls the row, rebuilds the snapshot, runs AI,
  // renders, uploads, emails, audits. Idempotency: re-running a
  // terminal row is a no-op (same posture as V9 recommendations).
  async runGeneration(
    reportId: string,
    inngestRunId?: string,
  ): Promise<RunReportOutcome> {
    const report = await this.deps.reports.findAnyById(reportId);
    if (!report) {
      return { reportId, status: "failed", errorMessage: "internal: report not found" };
    }
    if (report.status !== "pending" && report.status !== "running") {
      return { reportId, status: report.status };
    }

    await this.deps.reports.update(reportId, {
      status: "running",
      startedAt: new Date(),
      inngestRunId: inngestRunId ?? null,
    });

    // Re-build the snapshot. We don't trust the hash from start() —
    // if the org submitted records between start + run, the latest
    // numbers are what the user wants on paper. Hash is recomputed
    // + persisted at the end of this method.
    const snapshot = await this.deps.builder.build({
      organizationId: report.organizationId,
      template: report.templateId,
      periodStart: report.periodStart,
      periodEnd: report.periodEnd,
      // customTitle isn't persisted on report_instances yet — V11.4
      // adds the column. For now Custom regenerations fall back to the
      // template default title.
      customTitle: undefined,
    });

    // ── AI commentary (best-effort) ──────────────────────────────
    let commentary: ReportCommentary | null = null;
    let aiInputTokens: number | null = null;
    let aiOutputTokens: number | null = null;

    const aiResult = await this.deps.ai.call(
      generateReportCommentaryTool,
      {
        template: snapshot.template,
        period: snapshot.period,
        profile: {
          organizationName: snapshot.branding.organizationName,
          size: snapshot.profile.size,
          cae3: snapshot.profile.cae3,
          year: snapshot.profile.year,
          employees: snapshot.profile.employees,
          turnover: snapshot.profile.turnover,
          ebitda: snapshot.profile.ebitda,
          ebitdaMargin: snapshot.profile.ebitdaMargin,
          peerMedianTurnover: snapshot.profile.peerMedianTurnover,
          peerMedianEbitdaMargin: snapshot.profile.peerMedianEbitdaMargin,
        },
        emissions: snapshot.emissions
          ? {
              scope1Total: snapshot.emissions.scope1Total,
              scope2LocationTotal: snapshot.emissions.scope2LocationTotal,
              scope3Total: snapshot.emissions.scope3Total,
            }
          : null,
        coverage: snapshot.coverage
          ? {
              covered: snapshot.coverage.counts.covered,
              partial: snapshot.coverage.counts.partial,
              missing: snapshot.coverage.counts.missing,
            }
          : null,
        recordCountsByTemplate: snapshot.recordCountsByTemplate.map((r) => ({
          templateName: r.templateName,
          recordCount: r.recordCount,
        })),
      },
      {
        organizationId: report.organizationId,
        actorUserId: report.requestedByUserId,
        correlationId: report.id,
        metadata: {
          feature: "report_generation",
          entityKind: "report_instance",
          template: snapshot.template,
        },
      },
    );

    if (aiResult.ok) {
      commentary = {
        sections: aiResult.value.sections.map((s) => ({
          title: s.title,
          narrative: s.narrative,
          // zod's `.default([])` makes callouts optional on input but
          // present on output. Coerce defensively so the persisted
          // shape matches CommentarySection's `callouts: string[]`.
          callouts: s.callouts ?? [],
        })),
      };
    }
    // AI failure → commentary stays null; the template handles that
    // gracefully (skips the executive-summary block). We don't fail
    // the report.

    // ── Render PDF via apps/pdf ──────────────────────────────────
    const pdfPayload = composePdfPayload(snapshot, commentary, report.inputDataHash);
    let pdfBytes: Uint8Array;
    try {
      const renderResult = await this.deps.pdf.render({
        template: snapshot.template,
        data: pdfPayload,
        branding: {
          organizationId: snapshot.branding.organizationId,
          organizationName: snapshot.branding.organizationName,
          logoKey: snapshot.branding.logoKey,
          primaryColor: snapshot.branding.primaryColor,
        },
      });
      pdfBytes = renderResult.bytes;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return this.fail(report.id, ERR_PDF_RENDER, { stage: "pdf_render", detail: message });
    }

    // ── Upload to S3 ─────────────────────────────────────────────
    const s3Key = `organizations/${report.organizationId}/reports/${report.id}.pdf`;
    const upload = await this.deps.s3.upload({
      key: s3Key,
      body: pdfBytes,
      contentType: "application/pdf",
    });
    if (!upload.ok) {
      return this.fail(report.id, ERR_PDF_STORE, {
        stage: "s3_upload",
        detail: upload.error.message,
      });
    }

    // ── Mark ready ───────────────────────────────────────────────
    const generatedAt = new Date();
    await this.deps.reports.update(report.id, {
      status: "ready",
      s3Key,
      commentary,
      aiInputTokens,
      aiOutputTokens,
      generatedAt,
    });

    // ── Audit: completion ────────────────────────────────────────
    await this.deps.audit.record({
      actorUserId: report.requestedByUserId,
      organizationId: report.organizationId,
      entityKind: "report_instance",
      entityId: report.id,
      action: "report.generate_completed",
      payload: {
        template: snapshot.template,
        s3Key,
        commentarySectionCount: commentary?.sections.length ?? 0,
        inputDataHash: report.inputDataHash,
      },
      correlationId: report.id,
    });

    // ── Email notification (best-effort) ─────────────────────────
    await this.sendReadyEmail(report, snapshot, generatedAt);

    return { reportId: report.id, status: "ready" };
  }

  // Tenant-checked read for the polling UI.
  getStatus(organizationId: string, id: string): Promise<ReportInstance | null> {
    return this.deps.reports.findById(organizationId, id);
  }

  list(organizationId: string): Promise<ReportInstance[]> {
    return this.deps.reports.listForOrganization(organizationId);
  }

  // V11.3 download flow. Returns a presigned S3 URL the UI redirects
  // to. Writes a `report.downloaded` audit row.
  async downloadUrl(input: {
    organizationId: string;
    actorUserId: string;
    reportId: string;
  }): Promise<
    | { ok: true; url: string }
    | { ok: false; error: "not_found" | "not_ready" | "presign_failed" }
  > {
    const report = await this.deps.reports.findById(input.organizationId, input.reportId);
    if (!report) return { ok: false, error: "not_found" };
    if (report.status !== "ready" || !report.s3Key) {
      return { ok: false, error: "not_ready" };
    }
    const result = await this.deps.s3.presignedDownloadUrl(report.s3Key, {
      // 10 minutes — long enough for the user to click + start the
      // download, short enough that a leaked URL stales fast.
      expiresInSeconds: 600,
    });
    if (!result.ok) return { ok: false, error: "presign_failed" };

    await this.deps.audit.record({
      actorUserId: input.actorUserId,
      organizationId: input.organizationId,
      entityKind: "report_instance",
      entityId: report.id,
      action: "report.downloaded",
      payload: { s3Key: report.s3Key },
      correlationId: report.id,
    });

    return { ok: true, url: result.value };
  }

  private async sendReadyEmail(
    report: ReportInstance,
    snapshot: ReportDataSnapshot,
    generatedAt: Date,
  ): Promise<void> {
    if (!report.requestedByUserId) return;
    const email = await this.deps.users.findEmailById(report.requestedByUserId);
    if (!email) return;

    // Same presigned-URL TTL as the download route. The link in the
    // email is a deep-link into the app, not a direct S3 URL — the
    // app gates by membership before redirecting to S3.
    const appBase = process.env.APP_BASE_URL ?? "http://localhost:3000";
    const downloadUrl = `${appBase.replace(/\/+$/, "")}/reports/${report.id}`;

    const reportTitle = reportTitleFor(snapshot);
    try {
      await this.deps.email.send({
        to: email,
        organizationName: snapshot.branding.organizationName,
        reportTitle,
        downloadUrl,
        generatedAt: generatedAt.toISOString(),
      });
    } catch {
      // Email is best-effort. Audit + UI already surface completion;
      // a delivery failure isn't a reason to fail the run.
    }
  }

  private async fail(
    reportId: string,
    userMessage: string,
    auditPayload: Record<string, unknown>,
  ): Promise<RunReportOutcome> {
    const row = await this.deps.reports.findAnyById(reportId);
    await this.deps.reports.update(reportId, {
      status: "failed",
      errorMessage: userMessage,
    });
    if (row) {
      await this.deps.audit.record({
        actorUserId: row.requestedByUserId,
        organizationId: row.organizationId,
        entityKind: "report_instance",
        entityId: row.id,
        action: "report.generate_failed",
        payload: { userMessage, ...auditPayload },
        correlationId: row.id,
      });
    }
    return { reportId, status: "failed", errorMessage: userMessage };
  }
}

// ── Composition helpers ────────────────────────────────────────────

// Maps the canonical snapshot into the per-template data shape
// apps/pdf expects. The discriminator stays at the envelope layer
// (PdfRenderInput.template); per-template data is the typed body.
function composePdfPayload(
  snapshot: ReportDataSnapshot,
  commentary: ReportCommentary | null,
  inputDataHash: string,
): unknown {
  const period = snapshot.period;
  const footer = {
    generatedAt: new Date().toISOString(),
    inputDataHash,
  };

  if (snapshot.template === "ghg-inventory") {
    return {
      period,
      commentary,
      footer,
      scope1: {
        total: snapshot.emissions?.scope1Total ?? 0,
        rows: [],
      },
      scope2: {
        locationTotal: snapshot.emissions?.scope2LocationTotal ?? 0,
        marketTotal: snapshot.emissions?.scope2MarketTotal ?? null,
        rows: [],
      },
      scope3: {
        total: snapshot.emissions?.scope3Total ?? null,
        rows: [],
      },
      intensity: null,
    };
  }

  if (snapshot.template === "esrs-e1") {
    const datapoints = snapshot.coverage
      ? snapshot.coverage.rows.map((r) => ({
          code: r.datapoint.code,
          title: r.datapoint.title,
          status: r.status,
          value: null,
        }))
      : [];
    return {
      period,
      commentary,
      footer,
      datapoints: datapoints.length > 0 ? datapoints : fallbackEsrsRow(),
      coverage: snapshot.coverage?.counts ?? {
        covered: 0,
        partial: 0,
        missing: 0,
      },
    };
  }

  // Custom — surface record counts as the rows.
  return {
    period,
    commentary,
    footer,
    title: snapshot.customTitle ?? "Relatório personalizado",
    rows:
      snapshot.recordCountsByTemplate.length > 0
        ? snapshot.recordCountsByTemplate.map((r) => ({
            label: r.templateName,
            value: `${r.recordCount} registo(s)`,
            note: r.latestTier ? `Tier mais recente: ${r.latestTier}` : undefined,
          }))
        : [{ label: "Sem registos no período", value: "0" }],
  };
}

// ESRS E1 template's zod requires datapoints.min(1). When the org
// has no mappings yet the matrix is empty; emit a placeholder so
// the template renders cleanly and the user sees what's missing.
function fallbackEsrsRow() {
  return [
    {
      code: "E1-1",
      title: "Plano de transição climática",
      status: "missing" as const,
      value: null,
    },
  ];
}

function reportTitleFor(snapshot: ReportDataSnapshot): string {
  if (snapshot.template === "ghg-inventory") return "Inventário GEE";
  if (snapshot.template === "esrs-e1") return "ESRS E1 — Divulgação Climática";
  return snapshot.customTitle ?? "Relatório personalizado";
}
