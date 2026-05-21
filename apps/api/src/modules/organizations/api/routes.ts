import { sendInviteEmail } from "@bgreen/emails";
import { validateNif } from "@bgreen/pt-data";
import { LegalFormSchema, MembershipRoleSchema, OrganizationSizeSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import { requireOrgRelation } from "../../../auth-helpers.js";
import type { AppEnv } from "../../../context.js";
import { inviteService, organizationService, repositories } from "../../../services.js";

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
});

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
  });
