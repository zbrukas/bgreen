import { TemplateEditor } from "@/app/_components/TemplateEditor";
import { fetchMe } from "@/lib/api-client";
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
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/templates">← Voltar</Link>
        </p>
        <p>Apenas administradores podem criar modelos.</p>
      </main>
    );
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 720 }}>
      <p style={{ marginBottom: "1.5rem" }}>
        <Link href="/templates">← Voltar</Link>
      </p>
      <TemplateEditor />
    </main>
  );
}
