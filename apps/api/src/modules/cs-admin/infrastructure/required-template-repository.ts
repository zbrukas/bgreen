import { db, schema } from "@bgreen/db";
import type { OrganizationRequiredTemplate } from "@bgreen/types";
import { and, eq } from "drizzle-orm";
import type {
  AssignRequiredTemplateInput,
  RequiredTemplateRepository,
} from "../application/required-template-service.js";

function rowToAssignment(
  row: typeof schema.organizationRequiredTemplates.$inferSelect,
): OrganizationRequiredTemplate {
  return {
    organizationId: row.organizationId,
    templateId: row.templateId,
    recurrence: row.recurrence,
    firstDueAt: row.firstDueAt.toISOString(),
    assignedByUserId: row.assignedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// V12.1 — repository for CS required-template assignments. Cross-tenant
// reads/writes by design (CS staff manage every org's assignments).
// No orgScope() filter; routes gate behind canCsWrite.
export class DrizzleRequiredTemplateRepository implements RequiredTemplateRepository {
  async upsert(input: AssignRequiredTemplateInput): Promise<OrganizationRequiredTemplate> {
    const [row] = await db
      .insert(schema.organizationRequiredTemplates)
      .values({
        organizationId: input.organizationId,
        templateId: input.templateId,
        recurrence: input.recurrence,
        firstDueAt: input.firstDueAt,
        assignedByUserId: input.assignedByUserId,
      })
      .onConflictDoUpdate({
        target: [
          schema.organizationRequiredTemplates.organizationId,
          schema.organizationRequiredTemplates.templateId,
        ],
        set: {
          recurrence: input.recurrence,
          firstDueAt: input.firstDueAt,
          assignedByUserId: input.assignedByUserId,
          updatedAt: new Date(),
        },
      })
      .returning();
    if (!row) throw new Error("upsert organization_required_templates: empty returning()");
    return rowToAssignment(row);
  }

  async remove(input: { organizationId: string; templateId: string }): Promise<boolean> {
    const result = await db
      .delete(schema.organizationRequiredTemplates)
      .where(
        and(
          eq(schema.organizationRequiredTemplates.organizationId, input.organizationId),
          eq(schema.organizationRequiredTemplates.templateId, input.templateId),
        ),
      )
      .returning({ templateId: schema.organizationRequiredTemplates.templateId });
    return result.length > 0;
  }

  async listForOrganization(organizationId: string): Promise<OrganizationRequiredTemplate[]> {
    const rows = await db
      .select()
      .from(schema.organizationRequiredTemplates)
      .where(eq(schema.organizationRequiredTemplates.organizationId, organizationId));
    return rows.map(rowToAssignment);
  }
}
