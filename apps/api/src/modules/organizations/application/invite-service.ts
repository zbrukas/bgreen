import { randomBytes } from "node:crypto";
import type { Invite, InviteErrorCode, InvitePreview, MembershipRole } from "@bgreen/types";
import type { AuditService } from "../../audit/module.js";
import type { UserRepository } from "../../identity/application/user-service.js";
import type { MembershipRepository, OrganizationRepository } from "./organization-service.js";

const INVITE_TTL_DAYS = 7;
const TOKEN_BYTES = 32;

export interface CreateInviteInput {
  organizationId: string;
  invitedEmail: string;
  role: MembershipRole;
  invitedByUserId: string;
}

export interface InviteRepository {
  insert(input: {
    organizationId: string;
    invitedEmail: string;
    role: MembershipRole;
    token: string;
    invitedByUserId: string;
    expiresAt: Date;
  }): Promise<Invite>;
  findByToken(token: string): Promise<Invite | null>;
  markAccepted(input: { token: string; acceptedByUserId: string }): Promise<Invite>;
}

export interface InvitePreviewResult {
  invite: Invite;
  preview: InvitePreview;
}

export class InviteService {
  constructor(
    private readonly invites: InviteRepository,
    private readonly memberships: MembershipRepository,
    private readonly orgs: OrganizationRepository,
    private readonly users: UserRepository,
    private readonly audit: AuditService,
  ) {}

  async create(input: CreateInviteInput): Promise<Invite> {
    const token = randomBytes(TOKEN_BYTES).toString("base64url");
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000);
    const invite = await this.invites.insert({
      organizationId: input.organizationId,
      invitedEmail: input.invitedEmail.toLowerCase().trim(),
      role: input.role,
      token,
      invitedByUserId: input.invitedByUserId,
      expiresAt,
    });
    await this.audit.record({
      actorUserId: input.invitedByUserId,
      organizationId: input.organizationId,
      entityKind: "organization_invite",
      entityId: invite.id,
      action: "invite.created",
      payload: {
        invitedEmail: invite.invitedEmail,
        role: invite.role,
        expiresAt: invite.expiresAt,
      },
    });
    return invite;
  }

  async preview(input: {
    token: string;
    userEmail: string;
  }): Promise<InvitePreviewResult | { error: InviteErrorCode }> {
    const invite = await this.invites.findByToken(input.token);
    if (!invite) return { error: "not_found" };
    if (invite.status === "accepted") return { error: "already_accepted" };
    if (invite.status === "revoked") return { error: "revoked" };
    if (new Date(invite.expiresAt) < new Date()) return { error: "expired" };
    if (invite.invitedEmail.toLowerCase() !== input.userEmail.toLowerCase()) {
      return { error: "email_mismatch" };
    }

    const org = await this.orgs.findById(invite.organizationId);
    if (!org) return { error: "not_found" };
    const inviter = await this.users.findById(invite.invitedByUserId);
    if (!inviter) return { error: "not_found" };

    return {
      invite,
      preview: {
        organizationId: invite.organizationId,
        organizationName: org.name,
        inviterEmail: inviter.email,
        invitedEmail: invite.invitedEmail,
        role: invite.role,
        status: invite.status,
        expiresAt: invite.expiresAt,
      },
    };
  }

  async accept(input: {
    token: string;
    userId: string;
    userEmail: string;
  }): Promise<{ organizationId: string } | { error: InviteErrorCode }> {
    const previewed = await this.preview({ token: input.token, userEmail: input.userEmail });
    if ("error" in previewed) return previewed;

    const invite = previewed.invite;

    // Idempotent: if already a member, still close out the invite.
    const existing = await this.memberships.listForUser(input.userId);
    if (!existing.some((m) => m.organizationId === invite.organizationId)) {
      await this.memberships.add({
        userId: input.userId,
        organizationId: invite.organizationId,
        role: invite.role,
      });
    }

    await this.invites.markAccepted({ token: input.token, acceptedByUserId: input.userId });
    await this.audit.record({
      actorUserId: input.userId,
      organizationId: invite.organizationId,
      entityKind: "organization_invite",
      entityId: invite.id,
      action: "invite.accepted",
      payload: { acceptedEmail: input.userEmail, role: invite.role },
    });
    return { organizationId: invite.organizationId };
  }
}
