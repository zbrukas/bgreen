import { DrizzleUserRepository, UserService } from "./modules/identity/module.js";
import {
  DrizzleMembershipRepository,
  DrizzleOrganizationRepository,
  OrganizationService,
} from "./modules/organizations/module.js";

// Process-wide service instances. Repositories are cheap (no I/O at construction);
// the underlying pg pool in @bgreen/db connects lazily on first query.
export const userService = new UserService(new DrizzleUserRepository());

export const organizationService = new OrganizationService(
  new DrizzleOrganizationRepository(),
  new DrizzleMembershipRepository(),
);

export const repositories = {
  users: new DrizzleUserRepository(),
  organizations: new DrizzleOrganizationRepository(),
  memberships: new DrizzleMembershipRepository(),
};
