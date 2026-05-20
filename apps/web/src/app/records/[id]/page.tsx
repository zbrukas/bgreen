import { RecordForm } from "@/app/_components/RecordForm";
import { ReviewPanel } from "@/app/_components/ReviewPanel";
import { fetchMe, fetchRecord, fetchTemplate } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

const reviewCommentColor: Record<string, { bg: string; border: string; color: string }> = {
  approved: { bg: "#e8f5e9", border: "#a5d6a7", color: "#1b5e20" },
  changes_requested: { bg: "#fff3e0", border: "#ffcc80", color: "#bf6900" },
  rejected: { bg: "#ffebee", border: "#ef9a9a", color: "#b00020" },
};

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

  const [me, record] = await Promise.all([fetchMe(), fetchRecord(id)]);
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

  const isAdmin = me?.activeOrganizationRole === "admin";
  const isOwner = record.submittedByUserId === me?.id;
  const editable = isOwner && (record.status === "draft" || record.status === "changes_requested");
  const canReview = isAdmin && record.status === "submitted";
  const reviewStyle = reviewCommentColor[record.status];

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif", maxWidth: 760 }}>
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/records">← Voltar</Link>
      </p>
      <h1 style={{ margin: "0 0 0.25rem" }}>{tpl.name}</h1>
      <p style={{ margin: "0 0 1rem", color: "#666", fontSize: "0.9rem" }}>
        Estado: <strong>{statusLabel[record.status] ?? record.status}</strong>
      </p>
      {tpl.description && <p style={{ margin: "0 0 1rem", color: "#555" }}>{tpl.description}</p>}

      {record.reviewComment && reviewStyle && (
        <aside
          style={{
            margin: "0 0 1rem",
            padding: "0.75rem 1rem",
            background: reviewStyle.bg,
            border: `1px solid ${reviewStyle.border}`,
            color: reviewStyle.color,
            borderRadius: "0.25rem",
            fontSize: "0.9rem",
            whiteSpace: "pre-wrap",
          }}
        >
          <strong>Comentário do revisor:</strong>
          <div style={{ marginTop: "0.25rem" }}>{record.reviewComment}</div>
        </aside>
      )}

      <RecordForm
        template={tpl}
        recordId={record.id}
        initialValues={record.values}
        readOnly={!editable}
        initialStatus={record.status}
      />

      {canReview && <ReviewPanel recordId={record.id} />}
    </main>
  );
}
