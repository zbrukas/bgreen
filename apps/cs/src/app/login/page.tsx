import { Alert } from "@/components/ui/alert";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ setupSent?: string }>;
}

export default async function LoginPage({ searchParams }: PageProps) {
  const { setupSent } = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">bGreen · Central Services</h1>
        <p className="text-sm text-muted-foreground">
          Inicie sessão com o seu email e palavra-passe.
        </p>
      </div>
      {setupSent ? <Alert>Palavra-passe definida. Pode iniciar sessão.</Alert> : null}
      <LoginForm />
    </main>
  );
}
