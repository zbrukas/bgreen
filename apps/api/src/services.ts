import { DrizzleUserRepository, UserService } from "./modules/identity/module.js";
import {
  DrizzleInviteRepository,
  DrizzleMembershipRepository,
  DrizzleOrganizationRepository,
  InviteService,
  OrganizationService,
} from "./modules/organizations/module.js";

// Process-wide service instances. Repositories are cheap (no I/O at construction);
// the underlying pg pool in @bgreen/db connects lazily on first query.
export const repositories = {
  users: new DrizzleUserRepository(),
  organizations: new DrizzleOrganizationRepository(),
  memberships: new DrizzleMembershipRepository(),
  invites: new DrizzleInviteRepository(),
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
