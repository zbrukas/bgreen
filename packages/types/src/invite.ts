import { z } from "zod";
import { MembershipRoleSchema } from "./organization-membership";

export const InviteStatusSchema = z.enum(["pending", "accepted", "revoked", "expired"]);
export type InviteStatus = z.infer<typeof InviteStatusSchema>;

export const InviteSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  invitedEmail: z.string().email(),
  role: MembershipRoleSchema,
  // V5.6c: topic scope assigned at invite-time, carried into the
  // membership on accept. Empty array = no restriction.
  topicScope: z.array(z.string()).default([]),
  token: z.string().min(1),
  invitedByUserId: z.string().uuid(),
  status: InviteStatusSchema,
  expiresAt: z.string().datetime({ offset: true }),
  createdAt: z.string().datetime({ offset: true }),
  acceptedAt: z.string().datetime({ offset: true }).nullable(),
  acceptedByUserId: z.string().uuid().nullable(),
});
export type Invite = z.infer<typeof InviteSchema>;

// What we surface to the recipient before they accept. No token leak —
// the token is in the URL the recipient already has.
export const InvitePreviewSchema = z.object({
  organizationId: z.string().uuid(),
  organizationName: z.string(),
  inviterEmail: z.string().email(),
  invitedEmail: z.string().email(),
  role: MembershipRoleSchema,
  topicScope: z.array(z.string()).default([]),
  status: InviteStatusSchema,
  expiresAt: z.string().datetime({ offset: true }),
});
export type InvitePreview = z.infer<typeof InvitePreviewSchema>;

export const InviteErrorCodeSchema = z.enum([
  "not_found",
  "email_mismatch",
  "expired",
  "already_accepted",
  "revoked",
]);
export type InviteErrorCode = z.infer<typeof InviteErrorCodeSchema>;
