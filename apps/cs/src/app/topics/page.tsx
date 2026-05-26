import { PageHeader } from "@bgreen/ui";
import { fetchMe, fetchTopics } from "@/lib/api-client";
import { TopicListOptionsSchema } from "@bgreen/types";
import { Tag as TagIcon } from "@carbon/icons-react";
import { redirect } from "next/navigation";
import { AddTopicForm } from "./AddTopicForm";
import { TopicsTable } from "./TopicsTable";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CsTopicsPage({ searchParams }: PageProps) {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const canEdit = me.centralServicesRole === "admin" || me.centralServicesRole === "maintainer";
  const raw = await searchParams;
  const parsed = TopicListOptionsSchema.safeParse(raw);
  const options = parsed.success ? parsed.data : {};
  const pageSize = options.pageSize ?? 10;
  const page = options.page ?? 1;
  const { items: topics, total } = await fetchTopics({ ...options, page, pageSize });

  return (
    <>
      <PageHeader
        title="Tópicos"
        description="Catálogo de áreas (HR, financeiro, ambiente…) usado para etiquetar modelos e segmentar sub-templates por organização."
        icon={TagIcon}
      />
      <div className="mx-auto max-w-7xl space-y-8 px-8 py-10">
        {canEdit && <AddTopicForm />}
        <TopicsTable
          topics={topics}
          canEdit={canEdit}
          totalItems={total}
          page={page}
          pageSize={pageSize}
        />
      </div>
    </>
  );
}
