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
import { fetchMe, fetchMembers } from "@/lib/api-client";
import { withAuth } from "@workos-inc/authkit-nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  org_admin: "Administrador",
  org_user_write: "Membro",
  org_user_read: "Leitor",
};

interface PageProps {
  params: Promise<{ orgId: string }>;
}

export default async function MembersPage({ params }: PageProps) {
  const auth = await withAuth();
  if (!auth.user) redirect("/");

  const { orgId } = await params;
  const me = await fetchMe();
  if (!me || me.activeOrganizationId !== orgId || me.activeOrganizationRole !== "org_admin") {
    return (
      <main className="mx-auto max-w-3xl space-y-4 p-8">
        <p>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ← Voltar
          </Link>
        </p>
        <p>Apenas administradores da organização activa podem ver os membros.</p>
      </main>
    );
  }

  const members = await fetchMembers(orgId);

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-8">
      <p>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Voltar
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Membros</h1>
          <p className="text-sm text-muted-foreground">
            Defina o papel e o âmbito de tópicos de cada membro da organização.
          </p>
        </div>
        <Link
          href={`/organizations/${orgId}/invites/new`}
          className={buttonVariants({ variant: "outline" })}
        >
          + Convidar
        </Link>
      </div>

      {members.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sem membros ainda.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membro</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Âmbito</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.userId}>
                  <TableCell>
                    <div className="font-medium">{m.user?.email ?? m.userId.slice(0, 8)}</div>
                    {(m.user?.firstName || m.user?.lastName) && (
                      <div className="text-xs text-muted-foreground">
                        {[m.user.firstName, m.user.lastName].filter(Boolean).join(" ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{roleLabel[m.role] ?? m.role}</Badge>
                  </TableCell>
                  <TableCell>
                    {m.topicScope.length === 0 ? (
                      <span className="text-xs text-muted-foreground">— todos os tópicos —</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {m.topicScope.map((slug) => (
                          <Badge key={slug} variant="info" className="font-mono text-[10px]">
                            {slug}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href={`/organizations/${orgId}/members/${m.userId}`}
                      className="text-sm text-primary underline-offset-4 hover:underline"
                    >
                      Editar
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </main>
  );
}
