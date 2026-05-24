import { AnthropicAiClient } from "@bgreen/ai";
import { HttpViesClient } from "@bgreen/pt-data";
import { AwsS3Uploader, InMemoryS3Uploader, type S3Uploader } from "@bgreen/storage";
import { AuditService, DrizzleAuditRepository } from "./modules/audit/module.js";
import { CsAuthService } from "./modules/cs-auth/module.js";
import {
  DrizzleIesExtractionLogRepository,
  IesExtractionService,
  createAiToolCallObserver,
} from "./modules/economic-profile/module.js";
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
// The AnthropicAiClient observer writes audit_log rows for every tool call.
// One observer instance is shared by all callers — context (org, actor,
// correlation id) is passed per call via the third arg of client.call().
export const anthropicAiClient = new AnthropicAiClient({
  observer: createAiToolCallObserver(auditService),
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
);
