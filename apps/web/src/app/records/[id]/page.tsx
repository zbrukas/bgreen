import { RecordForm } from "@/app/_components/RecordForm";
import { fetchRecord, fetchTemplate } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RecordDetailPage({ params }: PageProps) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p>
          <a href={signInUrl}>Iniciar sessão</a> para ver o registo.
        </p>
      </main>
    );
  }

  const record = await fetchRecord(id);
  if (!record) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/records">← Voltar</Link>
        </p>
        <p>Registo não encontrado.</p>
      </main>
    );
  }

  const tpl = await fetchTemplate(record.templateId);
  if (!tpl) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/records">← Voltar</Link>
        </p>
        <p>Modelo associado não encontrado.</p>
      </main>
    );
  }

  const editable = record.status === "draft";

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/records">← Voltar</Link>
      </p>
      <h1 style={{ margin: "0 0 0.25rem" }}>{tpl.name}</h1>
      {tpl.description && <p style={{ margin: "0 0 1rem", color: "#555" }}>{tpl.description}</p>}
      <RecordForm
        template={tpl}
        recordId={record.id}
        initialValues={record.values}
        readOnly={!editable}
        initialStatus={record.status}
      />
    </main>
  );
}
