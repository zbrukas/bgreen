import { archiveTemplateAction, publishTemplateAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMe, fetchTemplate } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import type { Field, LeafField } from "@bgreen/types";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const fieldKindLabel: Record<string, string> = {
  text: "Texto",
  number: "Número",
  date: "Data",
  select: "Lista",
  multi_select: "Múltipla escolha",
  calculated: "Calculado",
  repeating: "Linhas repetidas",
};

const workflowLabel: Record<string, string> = {
  "single-step-submit": "Submissão simples",
  "two-step-review": "Revisão (2 passos)",
  "three-step-certify": "Certificação (3 passos)",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.user) {
    return (
      <main className="mx-auto max-w-xl p-8">
        <p>Inicie sessão para ver o modelo.</p>
      </main>
    );
  }

  const [me, tpl] = await Promise.all([fetchMe(), fetchTemplate(id)]);
  if (!tpl) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Modelo não encontrado.</p>
      </main>
    );
  }
  const isAdmin = me?.activeOrganizationRole === "org_admin";

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <p>
        <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{tpl.name}</h1>
          <p className="text-sm text-muted-foreground">
            Estado: <strong>{statusLabel[tpl.status] ?? tpl.status}</strong>
            <span className="mx-2">·</span>
            Fluxo:{" "}
            <strong>{workflowLabel[tpl.workflowDefinitionId] ?? tpl.workflowDefinitionId}</strong>
          </p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {tpl.status === "draft" && (
              <form action={publishTemplateAction}>
                <input type="hidden" name="id" value={tpl.id} />
                <Button type="submit" size="sm">
                  Publicar
                </Button>
              </form>
            )}
            {tpl.status !== "archived" && (
              <form action={archiveTemplateAction}>
                <input type="hidden" name="id" value={tpl.id} />
                <Button type="submit" size="sm" variant="outline">
                  Arquivar
                </Button>
              </form>
            )}
          </div>
        )}
      </div>

      {tpl.description && <p className="text-sm text-muted-foreground">{tpl.description}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campos</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-2">
            {tpl.formSchema.rows.flatMap((row) =>
              row.fields.map((field) => <FieldRow key={field.id} field={field} />),
            )}
          </ol>
        </CardContent>
      </Card>
    </main>
  );
}

function FieldRow({ field }: { field: Field | LeafField }) {
  return (
    <li className="space-y-1.5 rounded-md border bg-muted/30 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <code className="font-mono text-primary">{field.id}</code>
        <span className="text-muted-foreground">•</span>
        <strong>{field.label}</strong>
        <span className="text-muted-foreground">
          ({fieldKindLabel[field.kind] ?? field.kind}
          {field.required ? ", obrigatório" : ""})
        </span>
        {field.kind === "number" && field.unit && (
          <span className="text-muted-foreground">{field.unit}</span>
        )}

        {field.showIf && field.showIf.length > 0 && (
          <Badge variant="info">
            mostrar se {field.showIf.map((p) => `${p.fieldId}="${p.equals}"`).join(" e ")}
          </Badge>
        )}

        {field.sourceMapping && (
          <Badge variant="purple">
            pré-preenchido ← {field.sourceMapping.sourceFieldId} de outro modelo
          </Badge>
        )}
      </div>

      {field.kind === "calculated" && (
        <div className="text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{field.expression}</code>
          {field.unit && <span className="ml-1.5">→ {field.unit}</span>}
        </div>
      )}

      {(field.kind === "select" || field.kind === "multi_select") && (
        <ul className="space-y-0.5 text-xs text-muted-foreground">
          {field.options.map((opt) => (
            <li key={opt.value}>
              <code className="font-mono">{opt.value}</code> — {opt.label}
            </li>
          ))}
          {field.kind === "multi_select" &&
            (field.minSelected !== undefined || field.maxSelected !== undefined) && (
              <li className="mt-1 list-none">
                Seleções: {field.minSelected ?? 0}–{field.maxSelected ?? "∞"}
              </li>
            )}
        </ul>
      )}

      {field.kind === "repeating" && (
        <div className={cn("space-y-2 border-l-2 border-muted-foreground/30 pl-3")}>
          <p className="text-xs text-muted-foreground">
            Cada linha = <strong>{field.rowLabel}</strong>
            {(field.minRows !== undefined || field.maxRows !== undefined) && (
              <>
                {" "}
                · {field.minRows ?? 0}–{field.maxRows ?? "∞"} linhas
              </>
            )}
          </p>
          <ol className="space-y-1.5">
            {field.fields.map((sub) => (
              <FieldRow key={sub.id} field={sub} />
            ))}
          </ol>
        </div>
      )}
    </li>
  );
}
