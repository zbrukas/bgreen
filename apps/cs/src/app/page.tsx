import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMe } from "@/lib/api-client";
import { redirect } from "next/navigation";
import { Header } from "./_components/Header";

export const dynamic = "force-dynamic";

export default async function Home() {
  // Middleware guarantees a cs_session cookie. If the API doesn't know
  // the user (token expired, user deleted) we kick back to /login.
  const me = await fetchMe();
  if (!me) redirect("/login");

  return (
    <>
      <Header userEmail={me.email} role={me.centralServicesRole} />
      <main className="mx-auto max-w-3xl space-y-6 p-8">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Consola Central Services</h1>
          <p className="text-sm text-muted-foreground">
            Aqui mantemos os modelos, gerimos as organizações e revemos submissões.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sessão</CardTitle>
            <CardDescription>Detalhes do utilizador autenticado.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-mono text-xs">{me.email}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Papel CS</span>
              <span className="font-mono text-xs">{me.centralServicesRole ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
