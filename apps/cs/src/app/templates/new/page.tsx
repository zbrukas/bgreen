import { Header } from "@/app/_components/Header";
import { TemplateEditor } from "@/app/_components/TemplateEditor";
import { fetchMe, fetchTemplates } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const ORG_APP_URL = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";

export default async function NewTemplatePage() {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const me = await fetchMe();
  if (!me || me.userType !== "central_services") redirect(ORG_APP_URL);

  const templates = await fetchTemplates();
  const available = templates.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    formSchema: t.formSchema,
  }));

  return (
    <>
      <Header userEmail={me.email} role={me.centralServicesRole} />
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <p>
          <Link href="/templates" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <TemplateEditor availableTemplates={available} />
      </main>
    </>
  );
}
