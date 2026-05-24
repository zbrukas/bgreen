// IesExtractionService — orchestrates one IES extraction pipeline run.
//
// Called from an Inngest function with one logId. End state:
//   - awaiting_user_confirmation: extraction succeeded; user must confirm
//     in V6.4. The S3 PDF stays put until confirmation/cancellation.
//   - failed_not_ies: classifyDocument said the upload wasn't an IES.
//     Surface a pt-PT error; user re-uploads or switches to manual entry.
//   - failed_extraction: classify+extract path threw. Same handling.
//
// Each step persists progress so a re-run after a partial failure can
// pick up cleanly (and the V6.5 UI can show a real status bar).
//
// PerfilEconomicoValidator is pure — runs synchronously, no error path.

import type { AiClient } from "@bgreen/ai";
import type { S3Uploader } from "@bgreen/storage";
import type { IesExtractionLog } from "../domain/types.js";
import type {
  EconomicProfileRepository,
  OrganizationEconomicProfile,
} from "../infrastructure/economic-profile-repository.js";
import type { IesExtractionLogRepository } from "../infrastructure/ies-extraction-log-repository.js";
import { validatePerfilEconomico } from "./perfil-economico-validator.js";
import { classifyDocumentTool } from "./tools/classify-document-tool.js";
import { extractEconomicProfileTool } from "./tools/extract-economic-profile-tool.js";

// One-line pt-PT messages surfaced to the user. Kept here so the entire
// failure-vocabulary lives in one place.
const ERR_MISSING_S3_KEY = "Documento original em falta — recarregue o ficheiro.";
const ERR_S3_DOWNLOAD = "Não foi possível ler o documento do armazenamento. Tente novamente.";
const ERR_NOT_IES =
  "O documento carregado não parece ser um IES. Verifique se carregou o ficheiro correto.";
const ERR_AI_TRANSIENT =
  "O serviço de IA está temporariamente indisponível. Tente novamente em alguns minutos.";
const ERR_AI_PARSE = "Não foi possível extrair os dados deste IES. Considere a entrada manual.";

export interface IesExtractionRunResult {
  logId: string;
  status: IesExtractionLog["status"];
  errorMessage?: string;
}

// Fields the user may override on confirm. Each is optional; absent
// means "use whatever the AI extracted". An empty edits object is
// "accept the AI output verbatim".
export interface ExtractionEdits {
  year?: number;
  employees?: number | null;
  turnover?: number | null;
  ebitda?: number | null;
  balanceSheetTotal?: number | null;
  cae?: string | null;
}

export type ConfirmError =
  | "log_not_found"
  | "wrong_status"
  | "no_year"
  | "no_extraction";

export type ConfirmResult =
  | { ok: true; profile: OrganizationEconomicProfile }
  | { ok: false; error: ConfirmError };

export type CancelError = "log_not_found" | "wrong_status";

export type CancelResult = { ok: true } | { ok: false; error: CancelError };

export class IesExtractionService {
  constructor(
    private readonly repo: IesExtractionLogRepository,
    private readonly ai: AiClient,
    private readonly s3: S3Uploader,
    private readonly profiles: EconomicProfileRepository,
  ) {}

  // The orchestration entrypoint. `inngestRunId` is captured for cross-
  // referencing Inngest run logs from a failed extraction row.
  async runPipeline(logId: string, inngestRunId?: string): Promise<IesExtractionRunResult> {
    const log = await this.repo.findAnyById(logId);
    if (!log) {
      return { logId, status: "failed_extraction", errorMessage: "internal: log not found" };
    }
    if (!log.s3Key) {
      return this.fail(logId, "failed_extraction", ERR_MISSING_S3_KEY);
    }

    await this.repo.update(logId, {
      status: "extracting",
      startedAt: new Date(),
      inngestRunId: inngestRunId ?? null,
    });

    // Step 1: download PDF.
    const downloadResult = await this.s3.download(log.s3Key);
    if (!downloadResult.ok) {
      return this.fail(logId, "failed_extraction", ERR_S3_DOWNLOAD);
    }
    const pdfBase64 = bytesToBase64(downloadResult.value.body);

    // Audit context for the per-call observer. Correlates classify +
    // extract under one extraction id.
    const context = {
      organizationId: log.organizationId,
      actorUserId: log.uploadedByUserId,
      correlationId: log.id,
      metadata: { feature: "ies_extraction" },
    };

    // Step 2: classify.
    const classification = await this.ai.call(
      classifyDocumentTool,
      { pdfBase64 },
      context,
    );
    if (!classification.ok) {
      const message =
        classification.error.kind === "transient" ? ERR_AI_TRANSIENT : ERR_AI_PARSE;
      return this.fail(logId, "failed_extraction", message);
    }
    await this.repo.update(logId, { classificationResult: classification.value });

    if (classification.value.kind !== "ies") {
      return this.fail(logId, "failed_not_ies", ERR_NOT_IES);
    }

    // Step 3: extract.
    const extraction = await this.ai.call(
      extractEconomicProfileTool,
      { pdfBase64 },
      context,
    );
    if (!extraction.ok) {
      const message =
        extraction.error.kind === "transient" ? ERR_AI_TRANSIENT : ERR_AI_PARSE;
      return this.fail(logId, "failed_extraction", message);
    }

    // Step 4: validate. Pure — no failure mode (warnings only).
    const validated = validatePerfilEconomico(extraction.value);

    // Step 5: persist. S3 deletion intentionally deferred to user
    // confirmation (V6.4) — if extraction needs to be re-run, having
    // the original PDF still around lets us avoid asking the user to
    // re-upload.
    await this.repo.update(logId, {
      extractionResult: validated.profile,
      validatorWarnings: validated.warnings,
      year: validated.profile.year.value,
      status: "awaiting_user_confirmation",
      completedAt: new Date(),
    });

    return { logId, status: "awaiting_user_confirmation" };
  }

  // Tenant-checked status fetch for the polling UI.
  getStatus(organizationId: string, logId: string): Promise<IesExtractionLog | null> {
    return this.repo.findById(organizationId, logId);
  }

  // Persist the extraction (optionally with user edits) as an
  // organization_economic_profiles row, mark the log confirmed, and
  // delete the S3 PDF. Tenant-checked: the lookup filters by org.
  async confirm(
    organizationId: string,
    logId: string,
    edits: ExtractionEdits = {},
  ): Promise<ConfirmResult> {
    const log = await this.repo.findById(organizationId, logId);
    if (!log) return { ok: false, error: "log_not_found" };
    if (log.status !== "awaiting_user_confirmation") {
      return { ok: false, error: "wrong_status" };
    }
    const extraction = log.extractionResult;
    if (!extraction) return { ok: false, error: "no_extraction" };

    const editedKeys = Object.keys(edits) as Array<keyof ExtractionEdits>;
    const hasEdits = editedKeys.length > 0;

    // Resolve each field — edit wins over extraction. Year is required;
    // if neither side has it, the row can't be written.
    const year = edits.year ?? extraction.year.value;
    if (year === null || year === undefined) {
      return { ok: false, error: "no_year" };
    }

    const profile = await this.profiles.upsert({
      organizationId,
      year,
      employees: pick(edits.employees, extraction.employees.value),
      turnover: pick(edits.turnover, extraction.turnover.value),
      ebitda: pick(edits.ebitda, extraction.ebitda.value),
      balanceSheetTotal: pick(edits.balanceSheetTotal, extraction.balanceSheetTotal.value),
      cae: pick(edits.cae, extraction.cae.value),
      source: hasEdits ? "edited_after_extraction" : "ies_extracted",
      iesExtractionLogId: log.id,
    });

    // Mark confirmed first, then delete S3. If the S3 delete fails the
    // user still sees their profile + status=confirmed; the orphan
    // object is swept by lifecycle policy (future). Reversing the order
    // would leave a confirmed-but-PDF-still-present state on S3 errors,
    // which is worse for GDPR posture.
    await this.repo.update(log.id, {
      status: "confirmed",
      completedAt: new Date(),
    });
    await this.deletePdf(log);

    return { ok: true, profile };
  }

  // User aborts before confirmation. Deletes the PDF + marks cancelled.
  async cancel(organizationId: string, logId: string): Promise<CancelResult> {
    const log = await this.repo.findById(organizationId, logId);
    if (!log) return { ok: false, error: "log_not_found" };
    // Allow cancel from any non-terminal state. Terminal states ignore
    // the request silently (idempotent).
    const cancellableStatuses: IesExtractionLog["status"][] = [
      "pending",
      "extracting",
      "awaiting_user_confirmation",
    ];
    if (!cancellableStatuses.includes(log.status)) {
      return { ok: false, error: "wrong_status" };
    }
    await this.repo.update(log.id, {
      status: "cancelled",
      completedAt: new Date(),
    });
    await this.deletePdf(log);
    return { ok: true };
  }

  // Best-effort S3 delete. Logs (doesn't throw) on failure — the worst
  // case is an orphaned object that lifecycle policy will sweep. Logged
  // failures show up in the audit trail via the next extraction attempt
  // (or a future cleanup job in V6.5+).
  private async deletePdf(log: IesExtractionLog): Promise<void> {
    if (!log.s3Key) return;
    const result = await this.s3.delete(log.s3Key);
    if (!result.ok) {
      // eslint-disable-next-line no-console
      console.warn(
        `[ies-extraction] S3 delete failed for log=${log.id} key=${log.s3Key}: ${result.error.message}`,
      );
      return;
    }
    await this.repo.update(log.id, { s3DeletedAt: new Date(), s3Key: null });
  }

  private async fail(
    logId: string,
    status: "failed_not_ies" | "failed_extraction" | "failed_validation",
    errorMessage: string,
  ): Promise<IesExtractionRunResult> {
    await this.repo.update(logId, {
      status,
      errorMessage,
      completedAt: new Date(),
    });
    return { logId, status, errorMessage };
  }
}

// Helper for edits-vs-extraction resolution. The edit may explicitly
// be `null` (user clearing a value); `pick` honours that by
// distinguishing "key present and value=null" (use null) from "key
// absent" (use the extraction value).
function pick<T>(edit: T | undefined, fallback: T): T {
  return edit === undefined ? fallback : edit;
}

// Node Buffer.toString('base64') is the obvious way to do this, but we
// avoid leaking the Buffer import into application code — the function
// stays portable to runtimes that don't ship Buffer natively (Bun, edge).
// Uint8Array → base64 via a chunked btoa works in every modern runtime.
function bytesToBase64(bytes: Uint8Array): string {
  // 8KB chunks keep the call args under V8's argument-count budget.
  const CHUNK = 0x2000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const slice = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...slice);
  }
  // btoa is a global on Node 22 and every recent runtime.
  return btoa(binary);
}
