import { Header } from "@/app/_components/Header";
import { addTopicAction, deleteTopicAction } from "@/app/actions";
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
import { fetchMe, fetchTopics } from "@/lib/api-client";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CsTopicsPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const canEdit = me.centralServicesRole === "admin" || me.centralServicesRole === "maintainer";
  const topics = await fetchTopics();

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
          <h1 className="text-2xl font-semibold tracking-tight">Tópicos</h1>
          <p className="text-sm text-muted-foreground">
            Catálogo de áreas (HR, financeiro, ambiente…) usado para etiquetar modelos e segmentar
            sub-templates por organização.
          </p>
        </div>

        {canEdit && (
          <form
            action={async (formData) => {
              "use server";
              await addTopicAction({ error: null }, formData);
            }}
            className="space-y-3 rounded-lg border p-4"
          >
            <div className="grid grid-cols-[1fr_2fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="slug">Slug</Label>
                <Input id="slug" name="slug" placeholder="hr" className="font-mono" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" name="name" placeholder="Recursos Humanos" required />
              </div>
              <div className="flex items-end">
                <Button type="submit">Adicionar</Button>
              </div>
            </div>
          </form>
        )}

        {topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem tópicos registados.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Slug</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Adicionado</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {topics.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-mono">{t.slug}</TableCell>
                    <TableCell>{t.name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(t.createdAt).toLocaleString("pt-PT")}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <form action={deleteTopicAction}>
                          <input type="hidden" name="id" value={t.id} />
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
