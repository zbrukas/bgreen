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

export class IesExtractionService {
  constructor(
    private readonly repo: IesExtractionLogRepository,
    private readonly ai: AiClient,
    private readonly s3: S3Uploader,
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
