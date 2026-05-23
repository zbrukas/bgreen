import { RecordForm } from "@/app/_components/RecordForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { fetchMe, fetchRecordPrefill, fetchTemplate, fetchTopics } from "@/lib/api-client";
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
      <main className="mx-auto max-w-xl p-8">
        <p>
          <a href={signInUrl} className="text-primary underline-offset-4 hover:underline">
            Iniciar sessão
          </a>{" "}
          para submeter um registo.
        </p>
      </main>
    );
  }

  if (!templateId) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Escolha um modelo na lista de registos.</p>
      </main>
    );
  }

  const tpl = await fetchTemplate(templateId);
  if (!tpl) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Modelo não encontrado.</p>
      </main>
    );
  }
  if (tpl.status !== "published") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Este modelo não está publicado, não é possível submeter registos.</p>
      </main>
    );
  }

  const [prefill, me, topics] = await Promise.all([
    fetchRecordPrefill(templateId),
    fetchMe(),
    fetchTopics(),
  ]);
  const prefillCount = Object.keys(prefill).length;

  // V5.5: hydrate composed sub-templates in the order the catalogue
  // declared them. V5.6: filter by member's topic scope — empty scope
  // means no restriction; otherwise we drop subs whose topic isn't in
  // the actor's scope. Sub-templates without a topic tag are always
  // visible (untagged = unscoped).
  const topicSlugById = new Map(topics.map((t) => [t.id, t.slug]));
  const scope = new Set(me?.activeTopicScope ?? []);
  const allSubs = await Promise.all(
    tpl.composedSubTemplateIds.map((subId) => fetchTemplate(subId)),
  );
  const subTemplates = allSubs
    .filter((s): s is NonNullable<typeof s> => s !== null)
    .filter((s) => {
      if (scope.size === 0) return true;
      if (!s.topicTagId) return true;
      const slug = topicSlugById.get(s.topicTagId);
      return slug !== undefined && scope.has(slug);
    })
    .map((s) => ({ id: s.id, name: s.name, formSchema: s.formSchema }));

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-8">
      <p>
        <Link href="/records" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{tpl.name}</h1>
        {tpl.description && <p className="text-sm text-muted-foreground">{tpl.description}</p>}
      </div>
      {prefillCount > 0 && (
        <Alert variant="info">
          <AlertDescription>
            {prefillCount}{" "}
            {prefillCount === 1
              ? "campo foi pré-preenchido a partir de outro modelo."
              : "campos foram pré-preenchidos a partir de outros modelos."}
          </AlertDescription>
        </Alert>
      )}
      <RecordForm
        template={tpl}
        recordId={null}
        initialValues={prefill}
        subTemplates={subTemplates}
      />
    </main>
  );
}
