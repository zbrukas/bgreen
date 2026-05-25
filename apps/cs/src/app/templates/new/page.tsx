import { PageHeader } from "@/components/shell/PageHeader";
import { fetchMe, fetchTemplates, fetchTopics } from "@/lib/api-client";
import { Add } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { TemplateEditor } from "./_components/TemplateEditor/TemplateEditor";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const [templates, topics] = await Promise.all([fetchTemplates(), fetchTopics()]);
  // Source for prefill mappings: any template's fields.
  const available = templates.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    formSchema: t.formSchema,
  }));
  // Candidates for composition: only published sub-templates can be embedded.
  const subTemplates = templates
    .filter((t) => t.isSubTemplate && t.status === "published")
    .map((t) => ({ id: t.id, name: t.name, topicTagId: t.topicTagId }));

  return (
    <>
      <PageHeader
        title="Novo modelo"
        description="Defina nome, fluxo, e os campos do formulário. Pode salvar como rascunho e publicar mais tarde."
        icon={Add}
        breadcrumbs={[{ label: "Modelos", href: "/templates" }, { label: "Novo" }]}
      />
      <div className="mx-auto max-w-3xl px-8 py-6">
        <TemplateEditor
          availableTemplates={available}
          subTemplates={subTemplates}
          topics={topics}
        />
      </div>
    </>
  );
}
