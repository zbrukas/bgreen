import { TemplateEditor } from "@/app/_components/TemplateEditor";
import { fetchMe, fetchTemplates } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewTemplatePage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const me = await fetchMe();
  if (me?.activeOrganizationRole !== "admin") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Apenas administradores podem criar modelos.</p>
      </main>
    );
  }

  const templates = await fetchTemplates();
  const available = templates.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    formSchema: t.formSchema,
  }));

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <p>
        <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <TemplateEditor availableTemplates={available} />
    </main>
  );
}
