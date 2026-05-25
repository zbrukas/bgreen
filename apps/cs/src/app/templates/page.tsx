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
import Link from "next/link";
import { redirect } from "next/navigation";

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

export default async function CsTemplatesListPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const templates = await fetchTemplates();

  return (
    <>
      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <p>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Modelos</h1>
          <Link href="/templates/new" className={buttonVariants()}>
            + Novo modelo
          </Link>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ainda não existem modelos no catálogo.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Sub-template</TableHead>
                  <TableHead>Campos</TableHead>
                  <TableHead className="text-right" />
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
                      <TableCell className="text-muted-foreground">
                        {tpl.isSubTemplate ? "Sim" : "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{fieldCount}</TableCell>
                      <TableCell className="text-right text-sm">
                        <Link
                          href={`/templates/${tpl.id}`}
                          className="text-primary underline-offset-4 hover:underline"
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
    </>
  );
}
