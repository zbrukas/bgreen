import { HttpViesClient } from "@bgreen/pt-data";
import {
  DrizzleRecordTemplateRepository,
  RecordTemplateService,
} from "./modules/form-templates/module.js";
import { DrizzleUserRepository, UserService } from "./modules/identity/module.js";
import {
  DrizzleInviteRepository,
  DrizzleMembershipRepository,
  DrizzleOrganizationRepository,
  InviteService,
  OrganizationService,
} from "./modules/organizations/module.js";
import { DrizzleRecordRepository, RecordService } from "./modules/records/module.js";

// Process-wide service instances. Repositories are cheap (no I/O at construction);
// the underlying pg pool in @bgreen/db connects lazily on first query.
export const repositories = {
  users: new DrizzleUserRepository(),
  organizations: new DrizzleOrganizationRepository(),
  memberships: new DrizzleMembershipRepository(),
  invites: new DrizzleInviteRepository(),
  recordTemplates: new DrizzleRecordTemplateRepository(),
  records: new DrizzleRecordRepository(),
};

export const userService = new UserService(repositories.users);

export const organizationService = new OrganizationService(
  repositories.organizations,
  repositories.memberships,
);

export const inviteService = new InviteService(
  repositories.invites,
  repositories.memberships,
  repositories.organizations,
  repositories.users,
);

export const recordTemplateService = new RecordTemplateService(repositories.recordTemplates);

export const recordService = new RecordService(repositories.records, repositories.recordTemplates);

export const viesClient = new HttpViesClient({ timeoutMs: 4000 });
