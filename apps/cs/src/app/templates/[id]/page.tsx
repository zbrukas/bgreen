import { PageHeader } from "@bgreen/ui";
import { fetchMe, fetchTemplate, fetchTemplates, fetchTopics } from "@/lib/api-client";
import type { Field, LeafField } from "@bgreen/types";
import { Document } from "@carbon/icons-react";
import { Tag, Tile } from "@carbon/react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TemplateActions } from "./TemplateActions";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

type StatusTagType = "cool-gray" | "green" | "warm-gray";
const statusType: Record<string, StatusTagType> = {
  draft: "cool-gray",
  published: "green",
  archived: "warm-gray",
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
  const me = await fetchMe();
  if (!me) redirect("/login");

  const [tpl, allTemplates, topics] = await Promise.all([
    fetchTemplate(id),
    fetchTemplates(),
    fetchTopics(),
  ]);
  if (!tpl) {
    return (
      <PageHeader
        title="Modelo não encontrado"
        breadcrumbs={[{ label: "Modelos", href: "/templates" }, { label: id.slice(0, 8) }]}
      />
    );
  }

  const canWrite = me.centralServicesRole === "admin" || me.centralServicesRole === "maintainer";

  const topicName = tpl.topicTagId
    ? (topics.find((t) => t.id === tpl.topicTagId)?.name ?? "tópico desconhecido")
    : null;
  const templateNameById = new Map(allTemplates.map((t) => [t.id, t.name]));
  const composedNames = tpl.composedSubTemplateIds.map((subId) => ({
    id: subId,
    name: templateNameById.get(subId) ?? "sub-template removido",
  }));

  return (
    <>
      <PageHeader
        title={tpl.name}
        description={tpl.description ?? undefined}
        icon={Document}
        breadcrumbs={[{ label: "Modelos", href: "/templates" }, { label: tpl.name }]}
        actions={
          canWrite ? (
            <TemplateActions templateId={tpl.id} status={tpl.status} />
          ) : (
            <Tag type={statusType[tpl.status] ?? "cool-gray"}>
              {statusLabel[tpl.status] ?? tpl.status}
            </Tag>
          )
        }
      />
      <div className="space-y-6 px-8 py-6">
        <Tile>
          <div className="flex flex-wrap items-baseline gap-3 text-sm">
            <span className="text-neutral-600">Estado:</span>
            <Tag type={statusType[tpl.status] ?? "cool-gray"}>
              {statusLabel[tpl.status] ?? tpl.status}
            </Tag>
            <span className="text-neutral-600">Fluxo:</span>
            <strong>{workflowLabel[tpl.workflowDefinitionId] ?? tpl.workflowDefinitionId}</strong>
            {tpl.isSubTemplate && <Tag type="blue">Sub-template</Tag>}
            {topicName && <Tag type="purple">Tópico: {topicName}</Tag>}
          </div>
        </Tile>

        {composedNames.length > 0 && (
          <Tile>
            <h2 style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}>
              Sub-templates incluídos
            </h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {composedNames.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/templates/${c.id}`}
                    className="text-[var(--cds-link-primary)] hover:underline"
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ol>
          </Tile>
        )}

        <section>
          <h2
            className="mb-3"
            style={{ fontSize: "1rem", fontWeight: 600, lineHeight: 1.375, margin: 0 }}
          >
            Campos
          </h2>
          <ol className="space-y-2">
            {tpl.formSchema.rows.flatMap((row) =>
              row.fields.map((field) => <FieldRow key={field.id} field={field} />),
            )}
          </ol>
        </section>
      </div>
    </>
  );
}

function FieldRow({ field }: { field: Field | LeafField }) {
  return (
    <li className="space-y-1.5 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="text-[var(--cds-link-primary)]"
          style={{ fontFamily: "'IBM Plex Mono', monospace" }}
        >
          {field.id}
        </code>
        <span className="text-neutral-500">•</span>
        <strong>{field.label}</strong>
        <span className="text-neutral-500">
          ({fieldKindLabel[field.kind] ?? field.kind}
          {field.required ? ", obrigatório" : ""})
        </span>
        {field.kind === "number" && field.unit && (
          <span className="text-neutral-500">{field.unit}</span>
        )}
        {field.showIf && field.showIf.length > 0 && (
          <Tag type="blue" size="sm">
            mostrar se {field.showIf.map((p) => `${p.fieldId}="${p.equals}"`).join(" e ")}
          </Tag>
        )}
        {field.sourceMapping && (
          <Tag type="purple" size="sm">
            pré-preenchido ← {field.sourceMapping.sourceFieldId} de outro modelo
          </Tag>
        )}
      </div>
      {field.kind === "calculated" && (
        <div className="text-xs text-neutral-600">
          <code
            className="rounded bg-neutral-100 px-1.5 py-0.5"
            style={{ fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {field.expression}
          </code>
          {field.unit && <span className="ml-1.5">→ {field.unit}</span>}
        </div>
      )}
      {(field.kind === "select" || field.kind === "multi_select") && (
        <ul className="space-y-0.5 text-xs text-neutral-600">
          {field.options.map((opt) => (
            <li key={opt.value}>
              <code style={{ fontFamily: "'IBM Plex Mono', monospace" }}>{opt.value}</code> —{" "}
              {opt.label}
            </li>
          ))}
        </ul>
      )}
      {field.kind === "repeating" && (
        <div className="space-y-2 border-l-2 border-neutral-300 pl-3">
          <p className="text-xs text-neutral-600">
            Cada linha = <strong>{field.rowLabel}</strong>
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
