import { RecordForm } from "@/app/_components/RecordForm/RecordForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { fetchMe, fetchRecordPrefill, fetchTemplate, fetchTopics } from "@/lib/api-client";
import { Add, Document } from "@carbon/icons-react";
import { InlineNotification } from "@carbon/react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ template?: string }>;
}

export default async function NewRecordPage({ searchParams }: PageProps) {
  const { template: templateId } = await searchParams;
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  if (!templateId) {
    return (
      <>
        <PageHeader
          title="Novo registo"
          description="Escolha um modelo na lista de registos."
          icon={Add}
          breadcrumbs={[{ label: "Registos", href: "/records" }, { label: "Novo" }]}
        />
      </>
    );
  }

  const tpl = await fetchTemplate(templateId);
  if (!tpl) {
    return (
      <>
        <PageHeader
          title="Modelo não encontrado"
          breadcrumbs={[{ label: "Registos", href: "/records" }, { label: "Novo" }]}
        />
      </>
    );
  }
  if (tpl.status !== "published") {
    return (
      <>
        <PageHeader
          title={tpl.name}
          description="Este modelo não está publicado — não é possível submeter registos."
          icon={Document}
          breadcrumbs={[{ label: "Registos", href: "/records" }, { label: tpl.name }]}
        />
      </>
    );
  }

  const [prefill, me, topics] = await Promise.all([
    fetchRecordPrefill(templateId),
    fetchMe(),
    fetchTopics(),
  ]);
  const prefillCount = Object.keys(prefill).length;

  // V5.5: hydrate composed sub-templates in the order the catalogue
  // declared them. V5.6: filter by member's topic scope — empty scope
  // means no restriction; otherwise we drop subs whose topic isn't in
  // the actor's scope. Sub-templates without a topic tag are always
  // visible (untagged = unscoped).
  const topicSlugById = new Map(topics.map((t) => [t.id, t.slug]));
  const scope = new Set(me?.activeTopicScope ?? []);
  const allSubs = await Promise.all(
    tpl.composedSubTemplateIds.map((subId) => fetchTemplate(subId)),
  );
  const subTemplates = allSubs
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .filter((s) => {
      if (scope.size === 0) return true;
      if (!s.topicTagId) return true;
      const slug = topicSlugById.get(s.topicTagId);
      return slug !== undefined && scope.has(slug);
    })
    .map((s) => ({ id: s.id, name: s.name, formSchema: s.formSchema }));

  return (
    <>
      <PageHeader
        title={tpl.name}
        description={tpl.description ?? undefined}
        icon={Document}
        breadcrumbs={[{ label: "Registos", href: "/records" }, { label: tpl.name }]}
      />
      <div className="space-y-6 px-8 py-6">
        {prefillCount > 0 && (
          <InlineNotification
            kind="info"
            title="Pré-preenchimento aplicado"
            subtitle={
              prefillCount === 1
                ? "1 campo foi pré-preenchido a partir de outro modelo."
                : `${prefillCount} campos foram pré-preenchidos a partir de outros modelos.`
            }
            lowContrast
            hideCloseButton
          />
        )}
        <RecordForm
          template={tpl}
          recordId={null}
          initialValues={prefill}
          subTemplates={subTemplates}
        />
      </div>
    </>
  );
}
