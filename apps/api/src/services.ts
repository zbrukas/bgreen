import { AnthropicAiClient, composeObservers } from "@bgreen/ai";
import { sendReportReadyEmail } from "@bgreen/emails";
import { HttpPdfRenderer, InMemoryPdfRenderer, type PdfRenderer } from "@bgreen/pdf-engine";
import { HttpViesClient } from "@bgreen/pt-data";
import {
  AwsS3Uploader,
  FsUploader,
  InMemoryS3Uploader,
  type S3Uploader,
} from "@bgreen/storage";
import { AuditService, DrizzleAuditRepository } from "./modules/audit/module.js";
import { CsAuthService } from "./modules/cs-auth/module.js";
import {
  DrizzleEconomicProfileRepository,
  DrizzleIesExtractionLogRepository,
  EconomicProfileService,
  IesExtractionService,
  IesUploadService,
  createAiToolCallObserver,
  createAiToolCallPostHogObserver,
} from "./modules/economic-profile/module.js";
import {
  CoverageService,
  DrizzleFrameworkDatapointRepository,
  DrizzleTemplateDatapointMappingRepository,
} from "./modules/framework-coverage/module.js";
import { DrizzleSectorBenchmarkLookup } from "./modules/sector-benchmark/module.js";
import { buildPostHogTelemetry } from "./telemetry/posthog.js";
import { inngest } from "./inngest.js";
import {
  DrizzleCompositionRepository,
  DrizzleRecordTemplateRepository,
  RecordTemplateService,
} from "./modules/form-templates/module.js";
import { DrizzleCentralServicesDomainsRepository } from "./modules/identity/infrastructure/central-services-domains-repository.js";
import { DrizzleUserRepository, UserService } from "./modules/identity/module.js";
import {
  DrizzleInviteRepository,
  DrizzleMembershipRepository,
  DrizzleOrganizationRepository,
  InviteService,
  OrganizationService,
} from "./modules/organizations/module.js";
import {
  DrizzleGeneratedRecommendationRepository,
  DrizzleRecommendationFeedbackRepository,
  RecommendationsService,
} from "./modules/recommendations/module.js";
import { DrizzleRecordRepository, RecordService } from "./modules/records/module.js";
import {
  DrizzleReportInstanceRepository,
  ReportDataBuilder,
  ReportService,
} from "./modules/reports/module.js";
import { DrizzleTopicRepository, TopicService } from "./modules/topics/module.js";
import { DrizzleWorkflowRepository, WorkflowService } from "./modules/workflows/module.js";

// Process-wide service instances. Repositories are cheap (no I/O at construction);
// the underlying pg pool in @bgreen/db connects lazily on first query.
export const repositories = {
  users: new DrizzleUserRepository(),
  organizations: new DrizzleOrganizationRepository(),
  memberships: new DrizzleMembershipRepository(),
  invites: new DrizzleInviteRepository(),
  recordTemplates: new DrizzleRecordTemplateRepository(),
  records: new DrizzleRecordRepository(),
  audit: new DrizzleAuditRepository(),
  workflows: new DrizzleWorkflowRepository(),
  centralServicesDomains: new DrizzleCentralServicesDomainsRepository(),
  topics: new DrizzleTopicRepository(),
  compositions: new DrizzleCompositionRepository(),
  iesExtractionLogs: new DrizzleIesExtractionLogRepository(),
  economicProfiles: new DrizzleEconomicProfileRepository(),
  generatedRecommendations: new DrizzleGeneratedRecommendationRepository(),
  recommendationFeedback: new DrizzleRecommendationFeedbackRepository(),
  frameworkDatapoints: new DrizzleFrameworkDatapointRepository(),
  templateDatapointMappings: new DrizzleTemplateDatapointMappingRepository(),
  reportInstances: new DrizzleReportInstanceRepository(),
};

export const userService = new UserService(repositories.users, repositories.centralServicesDomains);

export const auditService = new AuditService(repositories.audit);

export const workflowService = new WorkflowService(repositories.workflows, auditService);

export const organizationService = new OrganizationService(
  repositories.organizations,
  repositories.memberships,
  auditService,
);

export const inviteService = new InviteService(
  repositories.invites,
  repositories.memberships,
  repositories.organizations,
  repositories.users,
  auditService,
);

export const topicService = new TopicService(repositories.topics);

export const recordTemplateService = new RecordTemplateService(
  repositories.recordTemplates,
  repositories.compositions,
);

export const recordService = new RecordService(
  repositories.records,
  repositories.recordTemplates,
  auditService,
  workflowService,
  repositories.topics,
);

export const viesClient = new HttpViesClient({ timeoutMs: 4000 });

export const csAuthService = new CsAuthService();

// AI + storage wiring for V6 (IES extraction).
//
// Two observers fan out from one client hook:
//   - audit: writes audit_log rows (regulated record, never optional).
//   - PostHog: product analytics (no-op when POSTHOG_API_KEY is absent).
// composeObservers isolates failures — an audit-write blip doesn't drop
// the PostHog event, and vice versa.
export const posthogTelemetry = buildPostHogTelemetry();

export const anthropicAiClient = new AnthropicAiClient({
  observer: composeObservers([
    createAiToolCallObserver(auditService),
    createAiToolCallPostHogObserver(posthogTelemetry),
  ]),
});

// Storage wiring. STORAGE_DRIVER picks the backend:
//   - `fs`: local filesystem under STORAGE_LOCAL_ROOT. Mirrors the
//     legacy bgreen strategy. Signed download URLs are served by the
//     route in apps/api/src/routes/storage-download.ts.
//   - `s3`: real S3 (or MinIO via S3_ENDPOINT). Presigning is native.
//   - `memory`: in-process map. Tests + ephemeral dev runs.
//
// When STORAGE_DRIVER is unset we infer from what env *is* present:
// STORAGE_URL_SIGNING_SECRET → fs, S3_BUCKET → s3, otherwise memory.
// This keeps tests-with-no-env working (they get memory) while letting
// operators configure fs or s3 by just dropping in the right env vars.
//
// `s3Uploader` is the type-erased export consumed by services. The
// `fsUploader` export is non-null only when the fs driver is active and
// lets app.ts mount the download route with the right instance.
function buildStorage(): { uploader: S3Uploader; fs: FsUploader | null } {
  const explicit = process.env.STORAGE_DRIVER?.toLowerCase();
  const hasFsConfig = !!process.env.STORAGE_URL_SIGNING_SECRET;
  const hasS3Config = !!process.env.S3_BUCKET;
  const driver =
    explicit ?? (hasFsConfig ? "fs" : hasS3Config ? "s3" : "memory");

  if (driver === "memory") {
    return { uploader: new InMemoryS3Uploader(), fs: null };
  }

  if (driver === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket) {
      throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET");
    }
    return {
      uploader: new AwsS3Uploader({
        bucket,
        region: process.env.AWS_REGION ?? "eu-central-1",
        endpoint: process.env.S3_ENDPOINT,
        // MinIO + most non-AWS S3 services require path-style addressing.
        forcePathStyle: process.env.S3_ENDPOINT !== undefined,
        credentials:
          process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
            ? {
                accessKeyId: process.env.S3_ACCESS_KEY_ID,
                secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
              }
            : undefined,
      }),
      fs: null,
    };
  }

  if (driver === "fs") {
    const rootDir = process.env.STORAGE_LOCAL_ROOT ?? "./data/storage";
    const signingSecret = process.env.STORAGE_URL_SIGNING_SECRET;
    if (!signingSecret) {
      throw new Error(
        "STORAGE_DRIVER=fs requires STORAGE_URL_SIGNING_SECRET (HMAC secret for download URLs)",
      );
    }
    const fsUp = new FsUploader({
      rootDir,
      signingSecret,
      publicBaseUrl: process.env.STORAGE_PUBLIC_BASE_URL,
    });
    return { uploader: fsUp, fs: fsUp };
  }

  throw new Error(`unknown STORAGE_DRIVER=${driver} (expected fs | s3 | memory)`);
}

const storage = buildStorage();
export const s3Uploader: S3Uploader = storage.uploader;
export const fsUploader: FsUploader | null = storage.fs;
export const storageUrlSigningSecret: string | undefined =
  process.env.STORAGE_URL_SIGNING_SECRET;

// V11.1 — PDF renderer wiring. PDF_URL + PDF_INTERNAL_TOKEN configure
// the HTTP adapter against apps/pdf. Both unset → an in-memory stub
// so unit-runnable smoke tests don't need apps/pdf running. V11.2
// teaches apps/pdf to actually render; until then the HTTP adapter
// returns render_failed via the 501 stub there.
function buildPdfRenderer(): PdfRenderer {
  const baseUrl = process.env.PDF_URL;
  const token = process.env.PDF_INTERNAL_TOKEN;
  if (!baseUrl || !token) return new InMemoryPdfRenderer();
  return new HttpPdfRenderer({ baseUrl, internalToken: token });
}

export const pdfRenderer = buildPdfRenderer();

export const iesExtractionService = new IesExtractionService(
  repositories.iesExtractionLogs,
  anthropicAiClient,
  s3Uploader,
  repositories.economicProfiles,
);

export const economicProfileService = new EconomicProfileService(
  repositories.economicProfiles,
);

export const sectorBenchmarkLookup = new DrizzleSectorBenchmarkLookup();

export const iesUploadService = new IesUploadService(
  repositories.iesExtractionLogs,
  s3Uploader,
  // Default Inngest sender — wraps the shared client. Tests substitute
  // a recording fake.
  {
    send: async (event) => {
      await inngest.send(event);
    },
  },
);

export const coverageService = new CoverageService(
  repositories.frameworkDatapoints,
  repositories.templateDatapointMappings,
  repositories.records,
  repositories.economicProfiles,
  repositories.organizations,
  anthropicAiClient,
  auditService,
);

export const recommendationsService = new RecommendationsService(
  repositories.generatedRecommendations,
  repositories.recommendationFeedback,
  anthropicAiClient,
  auditService,
  // Inngest sender for the generation pipeline. Same shape as the IES
  // upload sender; one wrapper per event name keeps the type narrow.
  {
    send: async (event) => {
      await inngest.send(event);
    },
  },
  {
    orgs: repositories.organizations,
    profiles: repositories.economicProfiles,
    sector: sectorBenchmarkLookup,
    records: repositories.records,
    templates: repositories.recordTemplates,
  },
);

// V11.3 — report pipeline. Data builder composes the repos +
// CoverageService; ReportService wires AI + PdfRenderer + S3 + email.
export const reportDataBuilder = new ReportDataBuilder(
  repositories.organizations,
  repositories.economicProfiles,
  sectorBenchmarkLookup,
  repositories.records,
  repositories.recordTemplates,
  coverageService,
);

export const reportService = new ReportService({
  reports: repositories.reportInstances,
  builder: reportDataBuilder,
  ai: anthropicAiClient,
  pdf: pdfRenderer,
  s3: s3Uploader,
  // Email sender is a thin port; the real impl wraps the
  // @bgreen/emails nodemailer transport. Tests substitute a recording fake.
  email: {
    send: (input) => sendReportReadyEmail(input),
  },
  // User-email lookup. Narrow port so the service doesn't depend on
  // identity internals; the DrizzleUserRepository's findById returns
  // the User domain which carries an email.
  users: {
    findEmailById: async (userId) => {
      const u = await repositories.users.findById(userId);
      return u?.email ?? null;
    },
  },
  events: {
    send: async (event) => {
      await inngest.send(event);
    },
  },
  audit: auditService,
});
