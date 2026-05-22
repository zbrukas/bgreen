import { Header } from "@/app/_components/Header";
import { TemplateEditor } from "@/app/_components/TemplateEditor";
import { fetchMe, fetchTemplates, fetchTopics } from "@/lib/api-client";
import Link from "next/link";
import { redirect } from "next/navigation";

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
      <Header userEmail={me.email} role={me.centralServicesRole} />
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <p>
          <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <TemplateEditor
          availableTemplates={available}
          subTemplates={subTemplates}
          topics={topics}
        />
      </main>
    </>
  );
}
