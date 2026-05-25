import { AnthropicAiClient, composeObservers } from "@bgreen/ai";
import { HttpViesClient } from "@bgreen/pt-data";
import { AwsS3Uploader, InMemoryS3Uploader, type S3Uploader } from "@bgreen/storage";
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

// S3 wiring. In production we point at a real EU bucket via env vars.
// In dev we point at MinIO (S3_ENDPOINT=http://localhost:9000 +
// path-style). If S3_BUCKET is unset we fall back to the in-memory
// uploader so unit-runnable smoke tests don't need MinIO running.
function buildS3Uploader(): S3Uploader {
  const bucket = process.env.S3_BUCKET;
  if (!bucket) return new InMemoryS3Uploader();
  return new AwsS3Uploader({
    bucket,
    region: process.env.AWS_REGION ?? "eu-central-1",
    endpoint: process.env.S3_ENDPOINT,
    // MinIO + most non-AWS S3 services require path-style addressing.
    // Auto-enable when S3_ENDPOINT is set (real S3 doesn't set this).
    forcePathStyle: process.env.S3_ENDPOINT !== undefined,
    credentials:
      process.env.S3_ACCESS_KEY_ID && process.env.S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
}

export const s3Uploader = buildS3Uploader();

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
