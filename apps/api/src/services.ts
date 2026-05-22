import { HttpViesClient } from "@bgreen/pt-data";
import { getFgaClient } from "./fga-client.js";
import { AuditService, DrizzleAuditRepository } from "./modules/audit/module.js";
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
};

export const fgaClient = getFgaClient();

export const userService = new UserService(
  repositories.users,
  repositories.centralServicesDomains,
  fgaClient,
);

export const auditService = new AuditService(repositories.audit);

export const workflowService = new WorkflowService(repositories.workflows, auditService);

export const organizationService = new OrganizationService(
  repositories.organizations,
  repositories.memberships,
  auditService,
  fgaClient,
);

export const inviteService = new InviteService(
  repositories.invites,
  repositories.memberships,
  repositories.organizations,
  repositories.users,
  auditService,
  fgaClient,
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
);

export const viesClient = new HttpViesClient({ timeoutMs: 4000 });
