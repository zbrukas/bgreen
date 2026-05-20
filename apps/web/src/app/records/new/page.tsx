import { RecordForm } from "@/app/_components/RecordForm";
import { fetchRecordPrefill, fetchTemplate } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ template?: string }>;
}

export default async function NewRecordPage({ searchParams }: PageProps) {
  const { template: templateId } = await searchParams;
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p>
          <a href={signInUrl}>Iniciar sessão</a> para submeter um registo.
        </p>
      </main>
    );
  }

  if (!templateId) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/records">← Voltar</Link>
        </p>
        <p>Escolha um modelo na lista de registos.</p>
      </main>
    );
  }

  const tpl = await fetchTemplate(templateId);
  if (!tpl) {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/records">← Voltar</Link>
        </p>
        <p>Modelo não encontrado.</p>
      </main>
    );
  }
  if (tpl.status !== "published") {
    return (
      <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
        <p style={{ marginBottom: "1rem" }}>
          <Link href="/records">← Voltar</Link>
        </p>
        <p>Este modelo não está publicado, não é possível submeter registos.</p>
      </main>
    );
  }

  const prefill = await fetchRecordPrefill(templateId);
  const prefillCount = Object.keys(prefill).length;

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/records">← Voltar</Link>
      </p>
      <h1 style={{ margin: "0 0 0.25rem" }}>{tpl.name}</h1>
      {tpl.description && <p style={{ margin: "0 0 1rem", color: "#555" }}>{tpl.description}</p>}
      {prefillCount > 0 && (
        <p
          style={{
            margin: "0 0 1rem",
            padding: "0.5rem 0.75rem",
            background: "#ede7f6",
            color: "#5b3e9b",
            border: "1px solid #d1c4e9",
            borderRadius: "0.25rem",
            fontSize: "0.85rem",
          }}
        >
          {prefillCount}{" "}
          {prefillCount === 1
            ? "campo foi pré-preenchido a partir de outro modelo."
            : "campos foram pré-preenchidos a partir de outros modelos."}
        </p>
      )}
      <RecordForm template={tpl} recordId={null} initialValues={prefill} />
    </main>
  );
}
