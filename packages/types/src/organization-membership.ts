import { z } from "zod";

export const MembershipRoleSchema = z.enum(["admin", "member"]);
export type MembershipRole = z.infer<typeof MembershipRoleSchema>;

export const OrganizationMembershipSchema = z.object({
  userId: z.string().uuid(),
  organizationId: z.string().uuid(),
  role: MembershipRoleSchema,
  createdAt: z.string().datetime({ offset: true }),
});

export type OrganizationMembership = z.infer<typeof OrganizationMembershipSchema>;
