import { Header } from "@/app/_components/Header";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCsInbox, fetchMe } from "@/lib/api-client";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CsInboxPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const inbox = await fetchCsInbox();

  return (
    <>
      <Header userEmail={me.email} role={me.centralServicesRole} />
      <main className="mx-auto max-w-5xl space-y-6 p-8">
        <p>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Revisão</h1>
          <p className="text-sm text-muted-foreground">
            Registos submetidos pelas organizações a aguardar decisão.
          </p>
        </div>

        {inbox.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem submissões pendentes neste momento.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Modelo / registo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {inbox.map((instance) => {
                  const state =
                    typeof instance.currentState === "string" ? instance.currentState : "—";
                  return (
                    <TableRow key={instance.id}>
                      <TableCell>
                        <Link
                          href={`/records/${instance.entityId}`}
                          className="font-medium text-primary underline-offset-4 hover:underline"
                        >
                          {(() => {
                            // Inbox returns workflow instances; we don't have
                            // the record's templateId at hand. Fall back to
                            // the entity id; future iterations can join.
                            return instance.entityId.slice(0, 8);
                          })()}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="info">{state}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(instance.updatedAt).toLocaleString("pt-PT")}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <Link
                          href={`/records/${instance.entityId}`}
                          className="text-primary underline-offset-4 hover:underline"
                        >
                          Rever
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
