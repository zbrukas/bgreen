import type { MembershipRole, User } from "@bgreen/types";

export interface AuthContext {
  user: User;
  workosUserId: string;
  // Active organization scope — populated when the request carries a valid
  // X-Organization-Id header and the user is a member of that org. Routes
  // that mutate tenant data should treat the absence of organizationId as
  // a 400/403; read-only listing endpoints can ignore it.
  organizationId?: string;
  membershipRole?: MembershipRole;
  // V5.6: ordered list of topic slugs the member can see. Empty array
  // means "no restriction" (full visibility); a non-empty list filters
  // which composed sub-templates the org form renders + which
  // sub-template values the API accepts on submit/update.
  topicScope?: string[];
}

export type AppEnv = {
  Variables: AuthContext;
};

export const ACTIVE_ORGANIZATION_HEADER = "X-Organization-Id";
