import { Header } from "@/app/_components/Header";
import { ReviewPanel } from "./_components/ReviewPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchCsRecord, fetchMe, fetchTemplate } from "@/lib/api-client";
import type { Field, LeafField } from "@bgreen/types";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

const statusVariant: Record<string, NonNullable<BadgeProps["variant"]>> = {
  draft: "outline",
  submitted: "info",
  approved: "success",
  changes_requested: "warning",
  rejected: "destructive",
};

const commentAlertVariant: Record<string, "success" | "warning" | "destructive"> = {
  approved: "success",
  changes_requested: "warning",
  rejected: "destructive",
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
      <>
        <Header userEmail={me.email} role={me.centralServicesRole} />
        <main className="mx-auto max-w-3xl space-y-4 p-8">
          <p>
            <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
              ← Voltar
            </Link>
          </p>
          <p>Registo não encontrado.</p>
        </main>
      </>
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
  const commentVariant = commentAlertVariant[record.status];

  return (
    <>
      <Header userEmail={me.email} role={me.centralServicesRole} />
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <p>
          <Link href="/inbox" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{tpl?.name ?? "Registo"}</h1>
          <Badge variant={statusVariant[record.status] ?? "outline"}>
            {statusLabel[record.status] ?? record.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Organização: <span className="font-mono">{record.organizationId}</span>
        </p>

        {record.reviewComment && commentVariant && (
          <Alert variant={commentVariant}>
            <AlertTitle>Comentário do revisor</AlertTitle>
            <AlertDescription className="whitespace-pre-wrap">
              {record.reviewComment}
            </AlertDescription>
          </Alert>
        )}

        {tpl && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Valores submetidos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tpl.formSchema.rows.map((row) => (
                <section
                  key={row.id}
                  className="space-y-2 border-t pt-3 first:border-t-0 first:pt-0"
                >
                  {row.label && <h3 className="text-sm font-medium">{row.label}</h3>}
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
                  className="space-y-2 rounded-md border border-primary/30 bg-primary/5 p-3"
                >
                  <h3 className="text-sm font-semibold">{sub.name}</h3>
                  {sub.formSchema.rows.map((row) => (
                    <div key={row.id} className="space-y-1">
                      {row.label && <h4 className="text-xs font-medium">{row.label}</h4>}
                      <dl className="space-y-1.5">
                        {row.fields.map((f) => (
                          <ReadOnlyField key={f.id} field={f} value={subValues[sub.id]?.[f.id]} />
                        ))}
                      </dl>
                    </div>
                  ))}
                </section>
              ))}
            </CardContent>
          </Card>
        )}

        {canReview && <ReviewPanel recordId={record.id} />}
      </main>
    </>
  );
}

function ReadOnlyField({ field, value }: { field: Field | LeafField; value: unknown }) {
  return (
    <div className="flex flex-wrap items-baseline gap-2 text-sm">
      <dt className="font-medium">{field.label}:</dt>
      <dd className="text-muted-foreground">{renderValue(field, value)}</dd>
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
