import { PageHeader } from "@bgreen/ui";
import { fetchMe, fetchTopics } from "@/lib/api-client";
import { Tag as TagIcon } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { AddTopicForm } from "./AddTopicForm";
import { TopicsTable } from "./TopicsTable";

export const dynamic = "force-dynamic";

export default async function CsTopicsPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const canEdit = me.centralServicesRole === "admin" || me.centralServicesRole === "maintainer";
  const topics = await fetchTopics();

  return (
    <>
      <PageHeader
        title="Tópicos"
        description="Catálogo de áreas (HR, financeiro, ambiente…) usado para etiquetar modelos e segmentar sub-templates por organização."
        icon={TagIcon}
      />
      <div className="space-y-6 px-8 py-6">
        {canEdit && <AddTopicForm />}
        <TopicsTable topics={topics} canEdit={canEdit} />
      </div>
    </>
  );
}
