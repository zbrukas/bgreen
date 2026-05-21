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
import { fetchMe, fetchMyRecords, fetchTemplates } from "@/lib/api-client";
import type { Record as BgRecord } from "@bgreen/types";
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

export default async function RecordsListPage() {
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main className="mx-auto max-w-xl p-8">
        <p>
          <a href={signInUrl} className="text-primary underline-offset-4 hover:underline">
            Iniciar sessão
          </a>{" "}
          para ver os registos.
        </p>
      </main>
    );
  }

  const [me, records, templates] = await Promise.all([
    fetchMe(),
    fetchMyRecords(),
    fetchTemplates(),
  ]);
  const templateNameById = new Map(templates.map((t) => [t.id, t.name]));
  const publishedTemplates = templates.filter((t) => t.status === "published");
  const isAdmin = me?.activeOrganizationRole === "admin";

  const pending = isAdmin ? records.filter((r) => r.status === "submitted") : [];
  const others = isAdmin ? records.filter((r) => r.status !== "submitted") : records;

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <p>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <h1 className="text-2xl font-semibold tracking-tight">
        {isAdmin ? "Registos da organização" : "Os meus registos"}
      </h1>

      {publishedTemplates.length > 0 && (
        <section className="space-y-2">
          <p className="text-sm text-muted-foreground">Submeter um novo registo:</p>
          <div className="flex flex-wrap gap-2">
            {publishedTemplates.map((tpl) => (
              <Link
                key={tpl.id}
                href={`/records/new?template=${tpl.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                + {tpl.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      {isAdmin && (
        <RecordsTable
          title={`Pendentes de revisão${pending.length > 0 ? ` (${pending.length})` : ""}`}
          emptyMessage="Nenhum registo aguarda revisão."
          records={pending}
          templateNameById={templateNameById}
          actionLabel="Rever"
        />
      )}

      <RecordsTable
        title={isAdmin ? "Restantes registos" : "Os meus registos"}
        emptyMessage="Ainda não existem registos."
        records={others}
        templateNameById={templateNameById}
      />
    </main>
  );
}

interface RecordsTableProps {
  title: string;
  emptyMessage: string;
  records: BgRecord[];
  templateNameById: Map<string, string>;
  actionLabel?: string;
}

function RecordsTable({
  title,
  emptyMessage,
  records,
  templateNameById,
  actionLabel,
}: RecordsTableProps) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium">{title}</h2>
      {records.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modelo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Submetido</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link
                      href={`/records/${r.id}`}
                      className="font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {templateNameById.get(r.templateId) ?? "(modelo removido)"}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[r.status] ?? "outline"}>
                      {statusLabel[r.status] ?? r.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.submittedAt ? new Date(r.submittedAt).toLocaleString("pt-PT") : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <Link
                      href={`/records/${r.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {actionLabel ??
                        (r.status === "draft" || r.status === "changes_requested"
                          ? "Continuar"
                          : "Ver")}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </section>
  );
}
