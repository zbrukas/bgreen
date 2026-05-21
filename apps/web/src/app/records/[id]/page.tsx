import { AuditTrail } from "@/app/_components/AuditTrail";
import { RecordForm } from "@/app/_components/RecordForm";
import { ReviewPanel } from "@/app/_components/ReviewPanel";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge, type BadgeProps } from "@/components/ui/badge";
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

const statusVariant: Record<string, NonNullable<BadgeProps["variant"]>> = {
  draft: "outline",
  submitted: "info",
  approved: "success",
  changes_requested: "warning",
  rejected: "destructive",
};

const commentAlertVariant: Record<string, "success" | "warning" | "destructive"> = {
  approved: "success",
  changes_requested: "warning",
  rejected: "destructive",
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
      <main className="mx-auto max-w-xl p-8">
        <p>
          <a href={signInUrl} className="text-primary underline-offset-4 hover:underline">
            Iniciar sessão
          </a>{" "}
          para ver o registo.
        </p>
      </main>
    );
  }

  const [me, record] = await Promise.all([fetchMe(), fetchRecord(id)]);
  if (!record) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Registo não encontrado.</p>
      </main>
    );
  }

  const tpl = await fetchTemplate(record.templateId);
  if (!tpl) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Modelo associado não encontrado.</p>
      </main>
    );
  }

  const isAdmin = me?.activeOrganizationRole === "org_admin";
  const isOwner = record.submittedByUserId === me?.id;
  const editable = isOwner && (record.status === "draft" || record.status === "changes_requested");
  const canReview = isAdmin && record.status === "submitted";
  const commentVariant = commentAlertVariant[record.status];

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <p>
        <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{tpl.name}</h1>
        <Badge variant={statusVariant[record.status] ?? "outline"}>
          {statusLabel[record.status] ?? record.status}
        </Badge>
      </div>
      {tpl.description && <p className="text-sm text-muted-foreground">{tpl.description}</p>}

      {record.reviewComment && commentVariant && (
        <Alert variant={commentVariant}>
          <AlertTitle>Comentário do revisor</AlertTitle>
          <AlertDescription className="whitespace-pre-wrap">
            {record.reviewComment}
          </AlertDescription>
        </Alert>
      )}

      <RecordForm
        template={tpl}
        recordId={record.id}
        initialValues={record.values}
        readOnly={!editable}
        initialStatus={record.status}
      />

      {canReview && <ReviewPanel recordId={record.id} />}

      {isAdmin && <AuditTrail entityKind="record" entityId={record.id} />}
    </main>
  );
}
