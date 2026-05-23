import { Header } from "@/app/_components/Header";
import { addCsUserAction, deleteCsUserAction, updateCsUserRoleAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchCsUsers, fetchMe } from "@/lib/api-client";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const roleLabel: Record<string, string> = {
  admin: "Admin",
  maintainer: "Maintainer",
  promoter: "Promoter",
};

export default async function CsUsersPage() {
  const me = await fetchMe();
  if (!me) redirect("/login");

  const isAdmin = me.centralServicesRole === "admin";
  const users = await fetchCsUsers();

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
          <h1 className="text-2xl font-semibold tracking-tight">Utilizadores CS</h1>
          <p className="text-sm text-muted-foreground">
            Convide colegas para a consola e defina o papel. Cada novo utilizador define a sua
            palavra-passe ao iniciar sessão pela primeira vez.
          </p>
        </div>

        {!isAdmin && (
          <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
            Apenas administradores CS podem adicionar/remover utilizadores ou alterar papéis.
          </p>
        )}

        {isAdmin && (
          <form
            action={async (formData) => {
              "use server";
              await addCsUserAction({ error: null }, formData);
            }}
            className="space-y-3 rounded-lg border p-4"
          >
            <div className="grid grid-cols-[2fr_1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="role">Papel</Label>
                <Select id="role" name="role" defaultValue="maintainer">
                  <option value="admin">Admin</option>
                  <option value="maintainer">Maintainer</option>
                  <option value="promoter">Promoter</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit">Adicionar</Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              O utilizador define a palavra-passe ao iniciar sessão pela primeira vez.
            </p>
          </form>
        )}

        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sem utilizadores CS registados.</p>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Papel</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Último login</TableHead>
                  <TableHead className="text-right" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === me.id;
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.email}</div>
                        {(u.firstName || u.lastName) && (
                          <div className="text-xs text-muted-foreground">
                            {[u.firstName, u.lastName].filter(Boolean).join(" ")}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {isAdmin ? (
                          <form action={updateCsUserRoleAction} className="inline-flex gap-1">
                            <input type="hidden" name="id" value={u.id} />
                            <Select
                              name="role"
                              defaultValue={u.centralServicesRole ?? "maintainer"}
                              className="h-8 w-auto py-0 text-xs"
                            >
                              <option value="admin">Admin</option>
                              <option value="maintainer">Maintainer</option>
                              <option value="promoter">Promoter</option>
                            </Select>
                            <Button type="submit" size="sm" variant="outline">
                              Guardar
                            </Button>
                          </form>
                        ) : (
                          <Badge variant="outline">
                            {roleLabel[u.centralServicesRole ?? ""] ?? u.centralServicesRole}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {u.passwordSet ? (
                          <Badge variant="success">Activo</Badge>
                        ) : (
                          <Badge variant="warning">A definir palavra-passe</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString("pt-PT") : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && !isSelf && (
                          <form action={deleteCsUserAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Remover
                            </Button>
                          </form>
                        )}
                        {isSelf && <span className="text-xs text-muted-foreground">(você)</span>}
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
