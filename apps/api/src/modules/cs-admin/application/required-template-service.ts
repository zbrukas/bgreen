import type { OrganizationRequiredTemplate, RequirementRecurrence } from "@bgreen/types";
import type { AuditService } from "../../audit/module.js";

export interface AssignRequiredTemplateInput {
  organizationId: string;
  templateId: string;
  recurrence: RequirementRecurrence;
  firstDueAt: Date;
  assignedByUserId: string;
}

export interface RequiredTemplateRepository {
  upsert(input: AssignRequiredTemplateInput): Promise<OrganizationRequiredTemplate>;
  remove(input: { organizationId: string; templateId: string }): Promise<boolean>;
  listForOrganization(organizationId: string): Promise<OrganizationRequiredTemplate[]>;
}

export type AssignResult =
  | { ok: true; assignment: OrganizationRequiredTemplate }
  | { ok: false; code: "template_not_found" | "organization_not_found" };

// V12.1 — required-template assignment surface. CS staff manage which
// templates each org is expected to submit on what cadence. The
// cs_org_health view (V12.2) joins this against `records` to compute
// the headline `coveragePercent`.
export class RequiredTemplateService {
  constructor(
    private readonly repo: RequiredTemplateRepository,
    private readonly audit: AuditService,
  ) {}

  async assign(input: AssignRequiredTemplateInput): Promise<AssignResult> {
    const assignment = await this.repo.upsert(input);
    await this.audit.record({
      actorUserId: input.assignedByUserId,
      organizationId: input.organizationId,
      entityKind: "organization_required_template",
      entityId: input.templateId,
      action: "required_template.assigned",
      payload: {
        recurrence: input.recurrence,
        firstDueAt: input.firstDueAt.toISOString(),
      },
    });
    return { ok: true, assignment };
  }

  async unassign(input: {
    organizationId: string;
    templateId: string;
    actorUserId: string;
  }): Promise<{ ok: true; removed: boolean }> {
    const removed = await this.repo.remove({
      organizationId: input.organizationId,
      templateId: input.templateId,
    });
    if (removed) {
      await this.audit.record({
        actorUserId: input.actorUserId,
        organizationId: input.organizationId,
        entityKind: "organization_required_template",
        entityId: input.templateId,
        action: "required_template.unassigned",
        payload: {},
      });
    }
    return { ok: true, removed };
  }

  listForOrganization(organizationId: string): Promise<OrganizationRequiredTemplate[]> {
    return this.repo.listForOrganization(organizationId);
  }
}
