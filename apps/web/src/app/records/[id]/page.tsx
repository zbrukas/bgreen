import { RecordForm } from "@/app/_components/RecordForm/RecordForm";
import { PageHeader } from "@/components/shell/PageHeader";
import { fetchMe, fetchRecord, fetchTemplate, fetchTopics } from "@/lib/api-client";
import { Document } from "@carbon/icons-react";
import { InlineNotification, Tag } from "@carbon/react";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { AuditTrail } from "./_components/AuditTrail";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  submitted: "Submetido",
  approved: "Aprovado",
  changes_requested: "Alterações pedidas",
  rejected: "Rejeitado",
};

type TagType = "cool-gray" | "blue" | "green" | "magenta" | "red";
const statusTagType: Record<string, TagType> = {
  draft: "cool-gray",
  submitted: "blue",
  approved: "green",
  changes_requested: "magenta",
  rejected: "red",
};

const commentKind: Record<string, "success" | "warning" | "error"> = {
  approved: "success",
  changes_requested: "warning",
  rejected: "error",
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RecordDetailPage({ params }: PageProps) {
  const { id } = await params;
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const [me, record] = await Promise.all([fetchMe(), fetchRecord(id)]);
  if (!record) {
    return (
      <>
        <PageHeader
          title="Registo não encontrado"
          breadcrumbs={[{ label: "Registos", href: "/records" }, { label: "—" }]}
        />
      </>
    );
  }

  const tpl = await fetchTemplate(record.templateId);
  if (!tpl) {
    return (
      <>
        <PageHeader
          title="Modelo associado não encontrado"
          breadcrumbs={[{ label: "Registos", href: "/records" }, { label: record.id }]}
        />
      </>
    );
  }

  // V5.5: hydrate sub-templates so RecordForm can render their sections
  // and route validation errors back to them. V5.6: drop subs whose
  // topic isn't in the actor's scope (empty scope = no restriction;
  // untagged subs are always visible).
  const [allSubs, topics] = await Promise.all([
    Promise.all(tpl.composedSubTemplateIds.map((subId) => fetchTemplate(subId))),
    fetchTopics(),
  ]);
  const topicSlugById = new Map(topics.map((t) => [t.id, t.slug]));
  const scope = new Set(me?.activeTopicScope ?? []);
  const subTemplates = allSubs
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .filter((s) => {
      if (scope.size === 0) return true;
      if (!s.topicTagId) return true;
      const slug = topicSlugById.get(s.topicTagId);
      return slug !== undefined && scope.has(slug);
    })
    .map((s) => ({ id: s.id, name: s.name, formSchema: s.formSchema }));

  const isAdmin = me?.activeOrganizationRole === "org_admin";
  const isOwner = record.submittedByUserId === me?.id;
  const editable = isOwner && (record.status === "draft" || record.status === "changes_requested");
  const reviewKind = commentKind[record.status];

  return (
    <>
      <PageHeader
        title={tpl.name}
        description={tpl.description ?? undefined}
        icon={Document}
        breadcrumbs={[{ label: "Registos", href: "/records" }, { label: tpl.name }]}
        actions={
          <Tag type={statusTagType[record.status] ?? "cool-gray"}>
            {statusLabel[record.status] ?? record.status}
          </Tag>
        }
      />
      <div className="space-y-6 px-8 py-6">
        {record.reviewComment && reviewKind && (
          <InlineNotification
            kind={reviewKind}
            title="Comentário do revisor"
            subtitle={record.reviewComment}
            lowContrast
            hideCloseButton
          />
        )}

        <RecordForm
          template={tpl}
          recordId={record.id}
          initialValues={record.values}
          readOnly={!editable}
          initialStatus={record.status}
          subTemplates={subTemplates}
        />

        {isAdmin && <AuditTrail entityKind="record" entityId={record.id} />}
      </div>
    </>
  );
}
