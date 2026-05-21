import { Badge, type BadgeProps } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchInbox, fetchMe, fetchMyRecords, fetchTemplates } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

const stateLabel: Record<string, string> = {
  draft: "Rascunho — preencher",
  submitted: "Submetido — rever",
  changes_requested: "Alterações pedidas — corrigir",
  approved: "Aprovado — certificar",
};

const stateVariant: Record<string, NonNullable<BadgeProps["variant"]>> = {
  draft: "outline",
  submitted: "info",
  changes_requested: "warning",
  approved: "success",
};

export default async function InboxPage() {
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main className="mx-auto max-w-xl p-8">
        <p>
          <a href={signInUrl} className="text-primary underline-offset-4 hover:underline">
            Iniciar sessão
          </a>{" "}
          para ver as tarefas pendentes.
        </p>
      </main>
    );
  }

  const [_me, inbox, templates, records] = await Promise.all([
    fetchMe(),
    fetchInbox(),
    fetchTemplates(),
    fetchMyRecords(),
  ]);
  const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
  // Map record-id → template-name via the record's templateId. Records the
  // user can't see (admins see all, members see only own) just render
  // "Registo" instead of a template name.
  const templateNameByRecord = new Map(
    records.map((r) => [r.id, templateNameById.get(r.templateId) ?? "Registo"]),
  );

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <p>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">Pendentes</h1>
      <p className="text-sm text-muted-foreground">
        Registos que aguardam a sua acção — preencher rascunhos, rever submissões ou certificar
        aprovações.
      </p>

      {inbox.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma tarefa pendente.{" "}
          <Link href="/records" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Ver todos os registos
          </Link>
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Acção</TableHead>
                <TableHead>Actualizado</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {inbox.map((instance) => {
                const state =
                  typeof instance.currentState === "string" ? instance.currentState : "—";
                const tplName = templateNameByRecord.get(instance.entityId) ?? "Registo";
                return (
                  <TableRow key={instance.id}>
                    <TableCell>
                      <Link
                        href={`/records/${instance.entityId}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {tplName}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={stateVariant[state] ?? "outline"}>
                        {stateLabel[state] ?? state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(instance.updatedAt).toLocaleString("pt-PT")}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <Link
                        href={`/records/${instance.entityId}`}
                        className="text-primary underline-offset-4 hover:underline"
                      >
                        Abrir
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
