import { PageHeader } from "@/components/shell/PageHeader";
import { fetchCsRecord, fetchMe, fetchTemplate } from "@/lib/api-client";
import type { Field, LeafField } from "@bgreen/types";
import { Document } from "@carbon/icons-react";
import { InlineNotification, Tag, Tile } from "@carbon/react";
import { redirect } from "next/navigation";
import { ReviewPanel } from "./_components/ReviewPanel";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

type TagType = "cool-gray" | "blue" | "green" | "magenta" | "red";
const statusTagType: Record<string, TagType> = {
  draft: "cool-gray",
  submitted: "blue",
  approved: "green",
  changes_requested: "magenta",
  rejected: "red",
};

const commentKind: Record<string, "success" | "warning" | "error"> = {
  approved: "success",
  changes_requested: "warning",
  rejected: "error",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CsRecordPage({ params }: PageProps) {
  const { id } = await params;
  const me = await fetchMe();
  if (!me) redirect("/login");

  const record = await fetchCsRecord(id);
  if (!record) {
    return (
      <PageHeader
        title="Registo não encontrado"
        breadcrumbs={[{ label: "Revisão", href: "/inbox" }, { label: id.slice(0, 8) }]}
      />
    );
  }

  const tpl = await fetchTemplate(record.templateId);
  // V5.5: hydrate composed sub-templates so the reviewer sees them
  // grouped by sub-template name, mirroring the org-side form.
  const subTemplates = tpl
    ? (await Promise.all(tpl.composedSubTemplateIds.map((subId) => fetchTemplate(subId)))).filter(
        (s): s is NonNullable<typeof s> => s !== null,
      )
    : [];
  const subValues =
    record.values && typeof record.values === "object"
      ? ((record.values as { subs?: Record<string, Record<string, unknown>> }).subs ?? {})
      : {};
  const canReview =
    record.status === "submitted" &&
    (me.centralServicesRole === "admin" || me.centralServicesRole === "maintainer");
  const reviewKind = commentKind[record.status];

  return (
    <>
      <PageHeader
        title={tpl?.name ?? "Registo"}
        description={`Organização: ${record.organizationId}`}
        icon={Document}
        breadcrumbs={[
          { label: "Revisão", href: "/inbox" },
          { label: tpl?.name ?? record.id.slice(0, 8) },
        ]}
        actions={
          <Tag type={statusTagType[record.status] ?? "cool-gray"}>
            {statusLabel[record.status] ?? record.status}
          </Tag>
        }
      />
      <div className="space-y-6 px-8 py-6">
        {record.reviewComment && reviewKind && (
          <InlineNotification
            kind={reviewKind}
            title="Comentário do revisor"
            subtitle={record.reviewComment}
            lowContrast
            hideCloseButton
          />
        )}

        {tpl && (
          <Tile>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
              Valores submetidos
            </h2>
            <div className="mt-4 space-y-4">
              {tpl.formSchema.rows.map((row) => (
                <section
                  key={row.id}
                  className="space-y-2 border-t border-neutral-200 pt-4 first:border-t-0 first:pt-0"
                >
                  {row.label && (
                    <h3
                      className="text-sm font-medium"
                      style={{ fontSize: "0.875rem", fontWeight: 600 }}
                    >
                      {row.label}
                    </h3>
                  )}
                  <dl className="space-y-1.5">
                    {row.fields.map((f) => (
                      <ReadOnlyField key={f.id} field={f} value={record.values[f.id]} />
                    ))}
                  </dl>
                </section>
              ))}
              {subTemplates.map((sub) => (
                <section
                  key={sub.id}
                  className="space-y-2 rounded-md border-l-2 border-l-[var(--cds-interactive)] bg-neutral-50 p-3"
                >
                  <h3 style={{ fontSize: "0.875rem", fontWeight: 600 }}>{sub.name}</h3>
                  {sub.formSchema.rows.map((row) => (
                    <div key={row.id} className="space-y-1">
                      {row.label && (
                        <h4 className="text-xs font-medium text-neutral-600">{row.label}</h4>
                      )}
                      <dl className="space-y-1.5">
                        {row.fields.map((f) => (
                          <ReadOnlyField key={f.id} field={f} value={subValues[sub.id]?.[f.id]} />
                        ))}
                      </dl>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </Tile>
        )}

        {canReview && <ReviewPanel recordId={record.id} />}
      </div>
    </>
  );
}

function ReadOnlyField({ field, value }: { field: Field | LeafField; value: unknown }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 text-sm">
      <dt className="font-medium">{field.label}:</dt>
      <dd className="text-neutral-600">{renderValue(field, value)}</dd>
    </div>
  );
}

function renderValue(field: Field | LeafField, value: unknown): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (field.kind) {
    case "select":
      return field.options.find((o) => o.value === value)?.label ?? String(value);
    case "multi_select":
      if (!Array.isArray(value) || value.length === 0) return "—";
      return value
        .map((v) => field.options.find((o) => o.value === v)?.label ?? String(v))
        .join(", ");
    case "number":
      return field.unit ? `${value} ${field.unit}` : String(value);
    case "calculated":
      if (typeof value !== "number") return "—";
      return field.unit ? `${value} ${field.unit}` : String(value);
    case "repeating":
      if (!Array.isArray(value) || value.length === 0) return "—";
      return `${value.length} ${value.length === 1 ? "linha" : "linhas"}`;
    default:
      return String(value);
  }
}
