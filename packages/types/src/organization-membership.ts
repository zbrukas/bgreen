import { z } from "zod";

// V5.4 split: was ['admin','member']; now three explicit org-side roles.
// `org_admin` ≈ legacy `admin`. `org_user_write` is legacy `member`.
// `org_user_read` is new (V5.4).
export const MembershipRoleSchema = z.enum(["org_admin", "org_user_write", "org_user_read"]);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const OrganizationMembershipSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: MembershipRoleSchema,
  // V5.5 topic-scoping placeholder. Empty array = no restriction.
  topicScope: z.array(z.string()).default([]),
  createdAt: z.string().datetime({ offset: true }),
});

export type OrganizationMembership = z.infer<typeof OrganizationMembershipSchema>;

// V5.4: every user is in exactly one population.
export const UserTypeSchema = z.enum(["central_services", "organization"]);
export type UserType = z.infer<typeof UserTypeSchema>;

export const CentralServicesRoleSchema = z.enum(["admin", "maintainer", "promoter"]);
export type CentralServicesRole = z.infer<typeof CentralServicesRoleSchema>;
