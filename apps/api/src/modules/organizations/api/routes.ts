import { sendInviteEmail } from "@bgreen/emails";
import { validateNif } from "@bgreen/pt-data";
import { LegalFormSchema, MembershipRoleSchema, OrganizationSizeSchema } from "@bgreen/types";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../../../context.js";
import { inviteService, organizationService, repositories } from "../../../services.js";

const createOrganizationInput = z.object({
  name: z.string().min(1).max(200),
  nif: z
    .string()
    .nullable()
    .optional()
    .refine((v) => v == null || v === "" || validateNif(v).valid, "invalid_nif"),
  legalForm: LegalFormSchema.nullable().optional(),
  selfReportedSize: OrganizationSizeSchema.nullable().optional(),
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

    const result = await organizationService.createWithOwner({
      ownerUserId: c.var.user.id,
      name: input.name,
      nif: normalizedNif,
      legalForm: input.legalForm ?? null,
      selfReportedSize: input.selfReportedSize ?? null,
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
    if (c.var.membershipRole !== "admin") {
      return c.json({ error: "admin_required" }, 403);
    }

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
