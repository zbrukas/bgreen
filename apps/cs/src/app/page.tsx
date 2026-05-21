import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMe } from "@/lib/api-client";
import { getSignInUrl, withAuth } from "@workos-inc/authkit-nextjs";
import { redirect } from "next/navigation";
import { Header } from "./_components/Header";

export const dynamic = "force-dynamic";

const ORG_APP_URL = process.env.APP_PUBLIC_URL ?? "http://localhost:3000";

export default async function Home() {
  const auth = await withAuth();
  if (!auth.user) {
    const signInUrl = await getSignInUrl();
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-8">
        <h1 className="text-4xl font-bold tracking-tight">bGreen · Central Services</h1>
        <p className="text-center text-muted-foreground">
          Consola interna de gestão de modelos, organizações e revisão de registos.
        </p>
        <a href={signInUrl} className={buttonVariants({ size: "lg" })}>
          Iniciar sessão
        </a>
      </main>
    );
  }

  const me = await fetchMe();
  if (!me || me.userType !== "central_services") {
    // Wrong population — bounce to the org app.
    redirect(ORG_APP_URL);
  }

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
