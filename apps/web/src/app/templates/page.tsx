import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchMe, fetchTemplates } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "success"> = {
  draft: "secondary",
  published: "success",
  archived: "outline",
};

export default async function TemplatesListPage() {
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main className="mx-auto max-w-xl p-8">
        <p>
          <a href={signInUrl} className="text-primary underline-offset-4 hover:underline">
            Iniciar sessão
          </a>{" "}
          para ver os modelos.
        </p>
      </main>
    );
  }

  const [me, templates] = await Promise.all([fetchMe(), fetchTemplates()]);
  const isAdmin = me?.activeOrganizationRole === "org_admin";

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <p>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Modelos de registo</h1>
        {isAdmin && (
          <Link href="/templates/new" className={buttonVariants()}>
            + Novo modelo
          </Link>
        )}
      </div>

      {templates.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Ainda não existem modelos.{" "}
          {isAdmin
            ? "Crie o primeiro para começar a recolher dados ESG."
            : "Peça a um administrador para criar um."}
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Campos</TableHead>
                <TableHead className="text-right">Acções</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((tpl) => {
                const fieldCount = tpl.formSchema.rows.reduce((n, r) => n + r.fields.length, 0);
                return (
                  <TableRow key={tpl.id}>
                    <TableCell>
                      <Link
                        href={`/templates/${tpl.id}`}
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {tpl.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[tpl.status] ?? "outline"}>
                        {statusLabel[tpl.status] ?? tpl.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{fieldCount}</TableCell>
                    <TableCell className={cn("text-right text-sm")}>
                      {tpl.status === "published" && (
                        <Link
                          href={`/records/new?template=${tpl.id}`}
                          className="mr-3 text-primary underline-offset-4 hover:underline"
                        >
                          Submeter
                        </Link>
                      )}
                      <Link
                        href={`/templates/${tpl.id}`}
                        className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                      >
                        Ver
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
