import { sendInviteEmail } from "@bgreen/emails";
import { validateNif } from "@bgreen/pt-data";
import { LegalFormSchema, MembershipRoleSchema, OrganizationSizeSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import {
  inviteService,
  organizationService,
  repositories,
  s3Uploader,
} from "../../../services.js";

const nullableTrimmed = z.string().nullable().optional();

const createOrganizationInput = z.object({
  name: z.string().min(1).max(200),
  nif: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || validateNif(v).valid, "invalid_nif"),
  // CAE Rev.3 codes are 3–5 digits. We accept the string as-is from the picker;
  // the catalog is the source of truth for what's a real code.
  caeCode: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || /^\d{3,5}$/.test(v), "invalid_cae_code"),
  legalForm: LegalFormSchema.nullable().optional(),
  selfReportedSize: OrganizationSizeSchema.nullable().optional(),
  postalCode: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || /^\d{4}-\d{3}$/.test(v), "invalid_postal_code"),
  addressLine: nullableTrimmed,
  freguesia: nullableTrimmed,
  concelho: nullableTrimmed,
  distrito: nullableTrimmed,
});

const createInviteInput = z.object({
  email: z.string().email().max(254),
  role: MembershipRoleSchema,
  topicScope: z.array(z.string()).default([]),
});

const updateMembershipInput = z.object({
  role: MembershipRoleSchema.optional(),
  topicScope: z.array(z.string()).optional(),
});

// V11.4 — branding update. Both fields optional + nullable so the UI
// can update one without resetting the other (omit) or clear one
// explicitly (null). Color enforced as #rrggbb hex.
const updateBrandingInput = z
  .object({
    logoUrl: z.string().min(1).max(2048).nullable().optional(),
    brandPrimaryColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "invalid_color")
      .nullable()
      .optional(),
  })
  .strict();

const requestLogoUploadInput = z
  .object({
    // Lowercase extension; we use it for the S3 object key + content
    // type. Validated against the small whitelist below.
    extension: z.enum(["png", "svg", "jpg", "jpeg", "webp"]),
  })
  .strict();

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  svg: "image/svg+xml",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function appPublicUrl(): string {
  return process.env.APP_PUBLIC_URL ?? "http://localhost:3000";
}

export const organizationsRoutes = new Hono<AppEnv>()
  .get("/", async (c) => {
    const orgs = await organizationService.listOrganizationsForUser(c.var.user.id);
    return c.json(orgs);
  })
  .post("/", zValidator("json", createOrganizationInput), async (c) => {
    const input = c.req.valid("json");
    // Normalize the NIF (strip whitespace) before persistence so callers
    // can be lazy about formatting.
    const nifResult = input.nif ? validateNif(input.nif) : null;
    const normalizedNif = nifResult?.valid ? nifResult.normalized : null;

    const stringOrNull = (v: string | null | undefined): string | null =>
      v && v.trim() !== "" ? v.trim() : null;

    const result = await organizationService.createWithOwner({
      ownerUserId: c.var.user.id,
      name: input.name,
      nif: normalizedNif,
      caeCode: input.caeCode && input.caeCode !== "" ? input.caeCode : null,
      legalForm: input.legalForm ?? null,
      selfReportedSize: input.selfReportedSize ?? null,
      postalCode: stringOrNull(input.postalCode),
      addressLine: stringOrNull(input.addressLine),
      freguesia: stringOrNull(input.freguesia),
      concelho: stringOrNull(input.concelho),
      distrito: stringOrNull(input.distrito),
    });
    return c.json(result, 201);
  })
  .post("/:orgId/invites", zValidator("json", createInviteInput), async (c) => {
    const orgId = c.req.param("orgId");
    if (!orgId) return c.json({ error: "missing_org_id" }, 400);

    // The caller's active-org cookie and the URL parameter must match —
    // prevents an admin of org A from inviting people to org B by accident.
    if (c.var.organizationId !== orgId) {
      return c.json({ error: "wrong_active_org" }, 403);
    }
    await requireOrgRelation(c.var.user.id, orgId, "org_admin");

    const org = await repositories.organizations.findById(orgId);
    if (!org) return c.json({ error: "org_not_found" }, 404);

    const input = c.req.valid("json");
    const invite = await inviteService.create({
      organizationId: orgId,
      invitedEmail: input.email,
      role: input.role,
      invitedByUserId: c.var.user.id,
      topicScope: input.topicScope,
    });

    const acceptUrl = `${appPublicUrl()}/invites/${invite.token}`;

    // Best-effort send. If SMTP is down or unconfigured, the admin UI shows
    // the copy-link fallback so the invite is still usable.
    const emailResult = await sendInviteEmail({
      to: invite.invitedEmail,
      organizationName: org.name,
      inviterEmail: c.var.user.email,
      role: invite.role,
      acceptUrl,
    });

    return c.json(
      {
        invite,
        acceptUrl,
        emailDelivered: emailResult.delivered,
        emailReason: emailResult.reason ?? null,
      },
      201,
    );
  })
  .get("/:orgId/members", async (c) => {
    const orgId = c.req.param("orgId");
    if (!orgId) return c.json({ error: "missing_org_id" }, 400);
    if (c.var.organizationId !== orgId) {
      return c.json({ error: "wrong_active_org" }, 403);
    }
    await requireOrgRelation(c.var.user.id, orgId, "org_admin");
    const memberships = await repositories.memberships.listForOrganization(orgId);
    const userIds = memberships.map((m) => m.userId);
    const users = await Promise.all(userIds.map((id) => repositories.users.findById(id)));
    const userById = new Map(users.filter((u) => u !== null).map((u) => [u.id, u]));
    const out = memberships.map((m) => ({
      ...m,
      user: userById.get(m.userId) ?? null,
    }));
    return c.json(out);
  })
  // V11.4 — request a presigned PUT URL for a new logo upload. The
  // client uploads bytes directly to S3, then PATCHes /branding with
  // the returned logoKey. Two-step flow keeps logo bytes off apps/api.
  .post(
    "/:orgId/branding/logo-upload-url",
    zValidator("json", requestLogoUploadInput),
    async (c) => {
      const orgId = c.req.param("orgId");
      if (!orgId) return c.json({ error: "missing_org_id" }, 400);
      if (c.var.organizationId !== orgId) {
        return c.json({ error: "wrong_active_org" }, 403);
      }
      await requireOrgRelation(c.var.user.id, orgId, "org_admin");
      const { extension } = c.req.valid("json");
      // Random suffix so consecutive uploads don't overwrite each
      // other server-side — the admin sees a clean replace via PATCH.
      const logoKey = `organizations/${orgId}/branding/logo-${crypto.randomUUID()}.${extension}`;
      const presign = await s3Uploader.presignedUploadUrl(logoKey, {
        contentType: CONTENT_TYPE_BY_EXTENSION[extension],
      });
      if (!presign.ok) {
        return c.json({ error: "presign_failed", reason: presign.error.message }, 500);
      }
      return c.json({ uploadUrl: presign.value, logoKey });
    },
  )
  // V11.4 — apply branding changes. logoUrl carries the S3 object key
  // (not a URL) — render-time resolution lives in apps/pdf. The column
  // is named logo_url for legacy alignment.
  .patch(
    "/:orgId/branding",
    zValidator("json", updateBrandingInput),
    async (c) => {
      const orgId = c.req.param("orgId");
      if (!orgId) return c.json({ error: "missing_org_id" }, 400);
      if (c.var.organizationId !== orgId) {
        return c.json({ error: "wrong_active_org" }, 403);
      }
      await requireOrgRelation(c.var.user.id, orgId, "org_admin");
      const input = c.req.valid("json");
      const updated = await organizationService.updateBranding({
        organizationId: orgId,
        actorUserId: c.var.user.id,
        logoUrl: input.logoUrl,
        brandPrimaryColor: input.brandPrimaryColor,
      });
      if (!updated) return c.json({ error: "org_not_found" }, 404);
      return c.json(updated);
    },
  )
  .patch("/:orgId/members/:userId", zValidator("json", updateMembershipInput), async (c) => {
    const orgId = c.req.param("orgId");
    const targetUserId = c.req.param("userId");
    if (!orgId || !targetUserId) return c.json({ error: "missing_param" }, 400);
    if (c.var.organizationId !== orgId) {
      return c.json({ error: "wrong_active_org" }, 403);
    }
    await requireOrgRelation(c.var.user.id, orgId, "org_admin");
    const input = c.req.valid("json");
    // Guard: an admin can't demote themselves below admin and lock out
    // the organization. They can still demote *other* admins.
    if (c.var.user.id === targetUserId && input.role && input.role !== "org_admin") {
      return c.json({ error: "cannot_demote_self" }, 400);
    }
    const updated = await repositories.memberships.update({
      userId: targetUserId,
      organizationId: orgId,
      role: input.role,
      topicScope: input.topicScope,
    });
    if (!updated) return c.json({ error: "membership_not_found" }, 404);
    return c.json(updated);
  });
