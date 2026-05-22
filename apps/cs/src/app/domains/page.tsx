import { Header } from "@/app/_components/Header";
import { addDomainAction, deleteDomainAction } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCsDomains, fetchMe } from "@/lib/api-client";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CsDomainsPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const canEdit = me.centralServicesRole === "admin";
  const domains = await fetchCsDomains();

  return (
    <>
      <Header userEmail={me.email} role={me.centralServicesRole} />
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <p>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Domínios CS</h1>
          <p className="text-sm text-muted-foreground">
            Domínios cujos sign-ups são automaticamente classificados como utilizadores Central
            Services.
          </p>
        </div>

        {canEdit && (
          <form
            action={async (formData) => {
              "use server";
              await addDomainAction({ error: null }, formData);
            }}
            className="space-y-3 rounded-lg border p-4"
          >
            <div className="grid grid-cols-[1fr_2fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="domain">Domínio</Label>
                <Input id="domain" name="domain" placeholder="nomad.consulting" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note">Nota (opcional)</Label>
                <Input id="note" name="note" placeholder="Consultoria parceira…" />
              </div>
              <div className="flex items-end">
                <Button type="submit">Adicionar</Button>
              </div>
            </div>
          </form>
        )}

        {domains.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem domínios registados.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Domínio</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Adicionado</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {domains.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono">{d.domain}</TableCell>
                    <TableCell className="text-muted-foreground">{d.note ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(d.createdAt).toLocaleString("pt-PT")}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <form action={deleteDomainAction}>
                          <input type="hidden" name="id" value={d.id} />
                          <Button type="submit" variant="ghost" size="sm">
                            Remover
                          </Button>
                        </form>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </>
  );
}
